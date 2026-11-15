// Server only: conversation orchestration, versions, rendering.
import { createAdminClient } from '@/lib/supabase/admin';
import { AiError, FRIENDLY, chatCompletion, estimateTokens, estimatedRemaining } from './codex';
import { buildTurnMessages, detectShuffle, focusedEditMessages, repairMessages } from './prompts';
import {
  applyItineraryPatch,
  cleanMissing,
  cleanThemeOptions,
  cleanTripPatch,
  isThemeKey,
  mergeTripDetails,
  parseModelJson,
  str,
  validateItinerary,
} from './schema';
import { getSettings, resolveModel } from './settings';
import { BUCKET, findTripPhoto, getObject, loadLogo, prepareImage, putObject, type LoadedImg } from './assets';
import { newSeed, resolveDesign, type DesignPrefs } from './design';
import { fontsFor } from './fonts';
import { renderItineraryPdf } from './pdf';
import {
  DEFAULT_SETTINGS,
  canGenerate,
  durationLabelOf,
  themeByKey,
  type Itinerary,
  type MessageMeta,
  type MissingField,
  type ProjectRow,
  type ProjectStatus,
  type StudioSettings,
  type ThemeKey,
  type ThemeOptions,
  type TripDetails,
} from './types';

const db = () => createAdminClient();

export class StudioError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function loadProject(id: string): Promise<ProjectRow> {
  const { data, error } = await db().from('ai_itinerary_projects').select('*').eq('id', id).maybeSingle();
  if (error) throw new StudioError(500, 'db', error.message);
  if (!data) throw new StudioError(404, 'not_found', 'Itinerary not found');
  return data as ProjectRow;
}

async function patchProject(id: string, patch: Record<string, unknown>) {
  const { error } = await db().from('ai_itinerary_projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new StudioError(500, 'db', error.message);
}

/* ─────────────────────────── jobs ─────────────────────────── */

/** Fail jobs that have been "running" longer than the stale window (server restart, crash). */
export async function reapStaleJobs(projectId: string, settings: StudioSettings) {
  const cutoff = new Date(Date.now() - settings.advanced.staleJobMinutes * 60_000).toISOString();
  const { data } = await db()
    .from('ai_generation_jobs')
    .update({ status: 'failed', error: 'Interrupted — the server stopped before this finished.', finished_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .select('id');
  if (data?.length) {
    const p = await loadProject(projectId);
    if (p.status === 'generating') await patchProject(projectId, { status: p.current_version_id ? 'pdf_ready' : 'failed', last_error: 'The last request was interrupted. Please try again.' });
  }
}

async function startJob(projectId: string, kind: string, stage: string) {
  const { data, error } = await db().from('ai_generation_jobs').insert({ project_id: projectId, kind, stage }).select('*').single();
  if (error) {
    if (error.code === '23505') throw new AiError('busy', FRIENDLY.busy);
    throw new StudioError(500, 'db', error.message);
  }
  return data as { id: string };
}
const setStage = (jobId: string, stage: string) => db().from('ai_generation_jobs').update({ stage }).eq('id', jobId).then(() => undefined);
async function finishJob(jobId: string, ok: boolean, error?: string) {
  await db().from('ai_generation_jobs').update({ status: ok ? 'succeeded' : 'failed', error: error || null, finished_at: new Date().toISOString() }).eq('id', jobId);
}

/* ─────────────────────────── rendering + versions ─────────────────────────── */

export function effectiveOptions(settings: StudioSettings, project: Pick<ProjectRow, 'theme_options'>): ThemeOptions {
  return { ...settings.pdf.defaultOptions, ...(project.theme_options || {}) };
}

export interface PhotoSet { cover: LoadedImg | null; days: Record<number, LoadedImg>; gallery: LoadedImg[]; count: number }

/**
 * Photos the admin attached to this itinerary, placed by role:
 * cover → cover; day N → that day; gallery → gallery page; auto → cover first,
 * then days without a photo (in order), then the gallery.
 */
export async function loadProjectPhotos(projectId: string | null | undefined, itinerary: Itinerary, options: ThemeOptions): Promise<PhotoSet> {
  const empty: PhotoSet = { cover: null, days: {}, gallery: [], count: 0 };
  if (options.images === 'none') return empty;
  const set: PhotoSet = { cover: null, days: {}, gallery: [], count: 0 };
  if (projectId) {
    const { data } = await db()
      .from('ai_itinerary_references')
      .select('id, storage_path, image_role, image_day, created_at')
      .eq('project_id', projectId)
      .eq('kind', 'image')
      .eq('status', 'ready')
      .order('created_at', { ascending: true })
      .limit(24);
    const rows = (data || []).filter((r: any) => r.image_role !== 'exclude');
    const loaded = await Promise.all(rows.map(async (r: any) => {
      const buf = await getObject(r.storage_path);
      return buf ? { r, img: await prepareImage(buf) } : null;
    }));
    const ok = loaded.filter((x): x is { r: any; img: LoadedImg } => !!x && !!x.img);
    const autos: LoadedImg[] = [];
    const dayNums = itinerary.days.map((d) => d.day);
    for (const { r, img } of ok) {
      if (r.image_role === 'cover' && !set.cover) set.cover = img;
      else if (r.image_role === 'day' && r.image_day && dayNums.includes(r.image_day) && !set.days[r.image_day]) set.days[r.image_day] = img;
      else if (r.image_role === 'gallery') set.gallery.push(img);
      else autos.push(img);
    }
    if (!set.cover && autos.length) set.cover = autos.shift()!;
    for (const n of dayNums) { if (!autos.length) break; if (!set.days[n]) set.days[n] = autos.shift()!; }
    set.gallery.push(...autos);
  }
  if (!set.cover) set.cover = await findTripPhoto(itinerary.destination);
  set.count = (set.cover ? 1 : 0) + Object.keys(set.days).length + set.gallery.length;
  return set;
}

/** Brand details for the PDF; blanks fall back to the website's own contact details (lib/contact.ts). */
export function brandOf(settings: StudioSettings) {
  const b = settings.pdf;
  const d = DEFAULT_SETTINGS.pdf;
  return {
    companyName: b.companyName || d.companyName,
    tagline: b.tagline,
    contactPerson: b.contactPerson,
    phone: b.phone || d.phone,
    whatsapp: b.whatsapp && b.whatsapp !== (b.phone || d.phone) ? b.whatsapp : undefined,
    email: b.email || d.email,
    website: b.website || d.website,
    instagram: b.instagram || d.instagram,
    address: b.address || d.address,
  };
}

export async function renderPdf(settings: StudioSettings, itinerary: Itinerary, options: ThemeOptions, ctx: { projectId?: string | null; seedKey?: string } = {}) {
  const photos = await loadProjectPhotos(ctx.projectId, itinerary, options);
  const design = resolveDesign(options.design, { photoCount: photos.count, dayCount: itinerary.days.length, legacyTheme: ctx.seedKey || ctx.projectId || itinerary.title });
  const [logo, fonts] = await Promise.all([loadLogo(settings.pdf.logoVersion), fontsFor(design)]);
  try {
    const out = renderItineraryPdf({ itinerary, design, options, brand: brandOf(settings), logo, photos, fonts });
    return { ...out, design };
  } catch (e) {
    throw new StudioError(500, 'render_failed', `PDF rendering failed: ${(e as Error).message}`);
  }
}

/** True while the title is still a placeholder or the auto "Destination · N Days / N Nights" label (not a name the admin chose). */
function isAutoTitle(p: Pick<ProjectRow, 'title' | 'destination'>) {
  const t = (p.title || '').trim();
  return !t || t === 'Untitled itinerary' || t === p.destination || / · \d+ Days? \/ \d+ Nights?$/.test(t);
}

async function nextVersionNo(projectId: string) {
  const { data } = await db().from('ai_itinerary_versions').select('version_no').eq('project_id', projectId).order('version_no', { ascending: false }).limit(1);
  return (data?.[0]?.version_no || 0) + 1;
}

export async function createVersion(
  settings: StudioSettings,
  project: ProjectRow,
  args: { itinerary: Itinerary; theme: ThemeKey; themeOptions: ThemeOptions; source: string; label?: string | null; model?: string | null }
) {
  const options = { ...settings.pdf.defaultOptions, ...args.themeOptions };
  const { buffer, pageCount } = await renderPdf(settings, args.itinerary, options, { projectId: project.id });
  for (let attempt = 0; attempt < 3; attempt++) {
    const versionNo = await nextVersionNo(project.id);
    const id = crypto.randomUUID();
    const pdfPath = `pdfs/${project.id}/${id}.pdf`;
    await putObject(pdfPath, buffer, 'application/pdf');
    const { data, error } = await db().from('ai_itinerary_versions').insert({
      id,
      project_id: project.id,
      version_no: versionNo,
      source: args.source,
      label: args.label || null,
      itinerary: args.itinerary,
      theme: args.theme,
      theme_options: args.themeOptions,
      pdf_path: pdfPath,
      pdf_size: buffer.length,
      page_count: pageCount,
      model: args.model || null,
    }).select('id, version_no').single();
    if (error?.code === '23505') continue; // concurrent version number — retry
    if (error) throw new StudioError(500, 'db', error.message);
    await patchProject(project.id, {
      itinerary: args.itinerary,
      theme: args.theme,
      theme_options: args.themeOptions,
      current_version_id: data.id,
      itinerary_dirty: false,
      is_final: false,
      status: 'pdf_ready',
      last_error: null,
      title: isAutoTitle(project) ? args.itinerary.title.slice(0, 140) : project.title,
      destination: args.itinerary.destination,
      duration_label: args.itinerary.durationLabel || project.duration_label,
    });
    return { id: data.id as string, versionNo: data.version_no as number, pageCount, size: buffer.length };
  }
  throw new StudioError(409, 'conflict', 'Could not save the version, please retry');
}

/* ─────────────────────────── messages ─────────────────────────── */

async function insertMessage(projectId: string, role: 'user' | 'assistant' | 'system', content: string, meta: MessageMeta = {}, clientId?: string | null) {
  const { data, error } = await db()
    .from('ai_itinerary_messages')
    .insert({ project_id: projectId, role, content, meta, client_id: clientId || null })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') return null;
    throw new StudioError(500, 'db', error.message);
  }
  return data;
}

function statusFor(project: { current_version_id: string | null }, trip: TripDetails, missing: MissingField[]): ProjectStatus {
  if (project.current_version_id) return 'pdf_ready';
  if (canGenerate(trip)) return 'ready';
  if (missing.some((m) => m.essential)) return 'clarifying';
  return Object.keys(trip).length ? 'collecting' : 'new';
}

const GEN_WORDS = /\b(generate|create|make|build|prepare|final|pdf|draft)\b/i;

/* ─────────────────────────── the conversation turn ─────────────────────────── */

export interface TurnInput {
  projectId: string;
  content: string;
  clientId: string;
  modelKey?: string | null;
  referenceIds?: string[];
  forceGenerate?: boolean;
  priority?: boolean;
}

export async function runTurn(input: TurnInput) {
  const settings = await getSettings();
  await reapStaleJobs(input.projectId, settings);
  let project = await loadProject(input.projectId);
  const content = (input.content || '').replace(/\0/g, '').trim().slice(0, 20000);
  if (!content && !input.forceGenerate) throw new StudioError(400, 'empty', 'Message is empty');

  // Idempotency: the same client message id never triggers a second paid request.
  const { data: dupe } = await db().from('ai_itinerary_messages').select('id').eq('project_id', project.id).eq('client_id', input.clientId).maybeSingle();
  if (dupe) return { duplicate: true };

  const model = resolveModel(settings, input.modelKey || project.model);
  if (!model) throw new StudioError(400, 'no_model', 'No verified, enabled model is available. Check Settings → AI.');

  const job = await startJob(project.id, input.forceGenerate ? 'generate' : 'chat', input.forceGenerate ? 'generating' : 'thinking');

  // Attachments shown on the user message.
  const attachIds = (input.referenceIds || []).slice(0, 10);
  let attachments: { id: string; filename: string; purpose: string; extracted_text: string | null; status: string }[] = [];
  if (attachIds.length) {
    const { data } = await db().from('ai_itinerary_references').select('id, filename, purpose, extracted_text, status').eq('project_id', project.id).in('id', attachIds);
    attachments = (data || []) as any;
  }
  const userText = content || 'Generate with available details.';
  const userMsg = await insertMessage(project.id, 'user', userText, {
    attachments: attachments.map((a) => ({ id: a.id, filename: a.filename })),
    intent: input.forceGenerate ? 'generate' : undefined,
  }, input.clientId);
  if (!userMsg) { await finishJob(job.id, false, 'duplicate'); return { duplicate: true }; }

  try {
    // ── zero-token path: "new design" / "shuffle" on an existing itinerary
    if (!input.forceGenerate && project.itinerary && !attachIds.length && detectShuffle(content)) {
      await setStage(job.id, 'rendering');
      const prev = project.theme_options?.design || {};
      const themeOptions = { ...(project.theme_options || {}), design: { ...prev, seed: newSeed(), cover: undefined, motif: undefined, dayStyle: undefined } };
      const v = await createVersion(settings, project, { itinerary: project.itinerary, theme: project.theme, themeOptions, source: 'theme', model: null });
      await insertMessage(project.id, 'assistant', `Here’s a fresh design — same content, new layout. Version ${v.versionNo} is ready (no AI tokens used). Say “new design” again for another variation.`, { intent: 'design_change', versionNo: v.versionNo });
      await finishJob(job.id, true);
      return { ok: true };
    }

    // ── context
    const { data: hist } = await db()
      .from('ai_itinerary_messages')
      .select('role, content, meta, id')
      .eq('project_id', project.id)
      .neq('id', userMsg.id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(Math.max(0, settings.ai.historyMessages));
    const history = (hist || [])
      .reverse()
      .filter((m: any) => !m.meta?.error)
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 2000) }));

    const likelyGenerate = !!input.forceGenerate || GEN_WORDS.test(content);
    const refIds = new Set(attachIds);
    const { data: refs } = await db()
      .from('ai_itinerary_references')
      .select('id, filename, purpose, extracted_text, status, kind, image_role, image_day, caption, meta, created_at')
      .eq('project_id', project.id)
      .eq('status', 'ready')
      .order('created_at', { ascending: true });
    const docs = (refs || []).filter((r: any) => r.kind !== 'image');
    const photos = (refs || []).filter((r: any) => r.kind === 'image')
      .map((r: any) => ({ id: r.id, filename: r.filename, caption: r.caption, role: r.image_role, day: r.image_day }));
    // Colours from the newest design reference (or the cover / first photo) for an "extracted" palette.
    const colourSource = [...(refs || [])].reverse().find((r: any) => r.meta?.palette && (r.purpose === 'design' || r.kind === 'image'));
    const extractedColours = colourSource ? { ...colourSource.meta.palette, source: colourSource.filename } : null;
    const refsForPrompt = docs
      .filter((r: any) => refIds.has(r.id) || (likelyGenerate && r.purpose !== 'extract'))
      .map((r: any) => ({ id: r.id, filename: r.filename, purpose: r.purpose, text: String(r.extracted_text || '').slice(0, settings.references.maxCharsPerReference) }));

    const messages = buildTurnMessages(settings, {
      tripDetails: project.trip_details || {},
      lockedFields: project.locked_fields || [],
      missing: project.missing_fields || [],
      summary: (project as any).context_summary || null,
      itinerary: project.itinerary,
      design: project.theme_options?.design || null,
      photos,
      extractedColours,
      references: refsForPrompt,
      history,
      message: content,
      forceGenerate: !!input.forceGenerate,
      autoGenerate: settings.ai.autoGenerateWhenReady,
      defaults: { company: settings.pdf.companyName, phone: settings.pdf.phone, email: settings.pdf.email, website: settings.pdf.website },
    });

    // ── allowance safeguard (local estimate)
    const inEst = estimateTokens(messages.map((m) => m.content).join('\n'));
    const outEst = likelyGenerate ? Math.min(settings.ai.maxOutputTokens, 6000) : 700;
    const est = Math.round((inEst + outEst) * model.multiplier);
    if (settings.ai.blockWhenInsufficient) {
      const bal = await estimatedRemaining(settings);
      if (bal.allowance > 0 && bal.remaining < est) {
        throw new AiError('insufficient_allowance', `${FRIENDLY.insufficient_allowance} Estimated need ≈ ${est.toLocaleString()} weighted tokens; estimated remaining ≈ ${Math.max(0, Math.round(bal.remaining)).toLocaleString()}. Update the allowance in Settings if you have topped up.`);
      }
    }

    await patchProject(project.id, { status: likelyGenerate ? 'generating' : project.status, model: model.key, last_error: null });
    if (likelyGenerate) await setStage(job.id, 'generating');

    const result = await chatCompletion({
      settings, model, messages, maxTokens: settings.ai.maxOutputTokens, json: true, priority: input.priority,
      kind: input.forceGenerate ? 'generate' : 'chat', projectId: project.id, jobId: job.id,
    });
    let usageIn = result.usage.input, usageOut = result.usage.output, weighted = result.weighted;

    let parsed: any;
    try {
      parsed = parseModelJson(result.content);
    } catch {
      if (result.finishReason === 'length') throw new AiError('malformed', 'The response was cut off because it hit the output limit. Increase “Max output tokens” in Settings → AI, or ask for a shorter itinerary.');
      parsed = { reply: result.content, action: 'none' };
    }

    // ── trip details
    project = await loadProject(project.id);
    const patch = cleanTripPatch(parsed.tripPatch);
    const merged = mergeTripDetails(project.trip_details || {}, patch, project.locked_fields || []);
    const missing = cleanMissing(parsed.missing);
    const summary = str(parsed.summary, 800) || (project as any).context_summary || null;
    const reply = str(parsed.reply, 6000) || 'Done.';
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.map((s: unknown) => str(s, 80)).filter(Boolean).slice(0, 3) : [];

    // Inferred reference purposes
    if (Array.isArray(parsed.referencePurposes)) {
      for (const rp of parsed.referencePurposes.slice(0, 10)) {
        const allowed = ['extract', 'structure', 'design', 'compare', 'rewrite', 'terms', 'new_from_old'];
        if (refIds.has(rp?.id) && allowed.includes(rp?.purpose)) {
          await db().from('ai_itinerary_references').update({ purpose: rp.purpose }).eq('id', rp.id).eq('purpose', 'auto');
        }
      }
    }

    const projectPatch: Record<string, unknown> = {
      trip_details: merged.next,
      missing_fields: missing,
      context_summary: summary,
    };
    const title = merged.next.tripName || (merged.next.destination ? `${merged.next.destination}${durationLabelOf(merged.next) ? ` · ${durationLabelOf(merged.next)}` : ''}` : null);
    if (project.title === 'Untitled itinerary' && title) projectPatch.title = title.slice(0, 140);
    if (merged.next.destination) projectPatch.destination = merged.next.destination;
    if (durationLabelOf(merged.next)) projectPatch.duration_label = durationLabelOf(merged.next);
    await patchProject(project.id, projectPatch);
    project = await loadProject(project.id);

    // ── actions
    let action = String(parsed.action || 'none');
    if (input.forceGenerate) action = 'generate';
    let versionNo: number | undefined;
    let changed: string[] = [...merged.changed];
    let note = '';

    const design = parsed.design && typeof parsed.design === 'object' ? parsed.design : null;
    const theme = project.theme as ThemeKey;
    let themeOptions: ThemeOptions = project.theme_options || {};
    if (design) {
      const { options, shuffle, ...prefs } = design as any;
      const cleaned = cleanThemeOptions({ design: prefs }).design || {};
      const nextDesign: DesignPrefs = { ...(themeOptions.design || {}), ...cleaned };
      if (shuffle === true) nextDesign.seed = newSeed();
      if (nextDesign.palette === 'extracted') {
        if (extractedColours) nextDesign.extracted = extractedColours;
        else delete nextDesign.palette;
      }
      themeOptions = { ...themeOptions, ...cleanThemeOptions(options), design: nextDesign };
      if (options?.sections) themeOptions.sections = { ...(project.theme_options?.sections || {}), ...cleanThemeOptions({ sections: options.sections }).sections };
    }

    // Photo placement requested in chat
    if (Array.isArray(parsed.photoRoles)) {
      const ids = new Set(photos.map((x) => x.id));
      for (const pr of parsed.photoRoles.slice(0, 20)) {
        if (!ids.has(pr?.id) || !['cover', 'day', 'gallery', 'exclude', 'auto'].includes(pr?.role)) continue;
        await db().from('ai_itinerary_references').update({ image_role: pr.role, image_day: pr.role === 'day' && Number.isInteger(pr.day) ? pr.day : null }).eq('id', pr.id);
      }
      if (parsed.photoRoles.length && action === 'none' && project.itinerary) action = 'design';
    }
    const attachedPhotos = attachments.some((a: any) => photos.some((x) => x.id === a.id));
    if (attachedPhotos && action === 'none' && project.itinerary) action = 'design';

    if (action === 'generate') {
      await setStage(job.id, 'validating');
      let v = validateItinerary(parsed.itinerary);
      if (!v.ok && parsed.itinerary) {
        await setStage(job.id, 'repairing');
        const rep = await chatCompletion({ settings, model, messages: repairMessages(JSON.stringify(parsed.itinerary), v.errors), maxTokens: settings.ai.maxOutputTokens, json: true, kind: 'repair', projectId: project.id, jobId: job.id });
        usageIn = (usageIn ?? 0) + (rep.usage.input ?? 0); usageOut = (usageOut ?? 0) + (rep.usage.output ?? 0); weighted = (weighted ?? 0) + (rep.weighted ?? 0);
        try { v = validateItinerary(parseModelJson(rep.content)); } catch { /* keep failure */ }
      }
      if (!v.ok) {
        if (!parsed.itinerary && !input.forceGenerate) action = 'none';
        else throw new AiError('malformed', `The generated itinerary did not pass validation (${(v as any).errors.join('; ')}). Nothing was changed — try again.`);
      } else {
        await setStage(job.id, 'rendering');
        const ver = await createVersion(settings, project, { itinerary: v.value, theme, themeOptions, source: 'generate', model: model.key });
        versionNo = ver.versionNo;
        changed.push('itinerary');
      }
    } else if (action === 'edit') {
      if (!project.itinerary) {
        note = '';
      } else {
        await setStage(job.id, 'editing');
        const ip = parsed.itineraryPatch ?? parsed.itinerary;
        let res: { value: Itinerary; changed: string[] } | { error: string } = !ip
          ? { error: 'no changes were returned' }
          : parsed.itineraryPatch
            ? applyItineraryPatch(project.itinerary, ip)
            : (() => { const v = validateItinerary(ip); return v.ok ? { value: v.value, changed: ['itinerary'] } : { error: v.errors.join('; ') }; })();
        // The model sometimes records a change only in trip details / assumptions and never edits
        // the document. Detect a no-op on the real content and make one focused retry.
        const contentOf = (it: Itinerary) => JSON.stringify({ ...it, assumptions: [] });
        const unchanged = (r: typeof res) => 'error' in r || contentOf(r.value) === contentOf(project.itinerary!);
        if (unchanged(res)) {
          try {
            const fe = await chatCompletion({ settings, model, messages: focusedEditMessages(project.itinerary, content), maxTokens: settings.ai.maxOutputTokens, json: true, kind: 'edit', projectId: project.id, jobId: job.id });
            usageIn = (usageIn ?? 0) + (fe.usage.input ?? 0); usageOut = (usageOut ?? 0) + (fe.usage.output ?? 0); weighted = (weighted ?? 0) + (fe.weighted ?? 0);
            const fp: any = parseModelJson(fe.content);
            const retry = applyItineraryPatch(project.itinerary, fp?.itineraryPatch ?? fp);
            if (!unchanged(retry)) res = retry;
          } catch { /* fall through to the honest note below */ }
        }
        if (!('error' in res) && unchanged(res)) res = { error: 'the itinerary content did not change' };
        if ('error' in res) {
          note = `\n\n⚠ The itinerary itself was NOT changed (${res.error}). Please rephrase the change, or edit it directly in the Itinerary tab.`;
        } else {
          await setStage(job.id, 'rendering');
          const ver = await createVersion(settings, project, { itinerary: res.value, theme, themeOptions, source: 'edit', model: model.key });
          versionNo = ver.versionNo;
          changed.push(...res.changed);
        }
      }
    } else if (action === 'design' || design) {
      if (project.itinerary) {
        await setStage(job.id, 'rendering');
        const ver = await createVersion(settings, project, { itinerary: project.itinerary, theme, themeOptions, source: 'theme', model: null });
        versionNo = ver.versionNo;
      } else {
        await patchProject(project.id, { theme, theme_options: themeOptions });
      }
    }

    project = await loadProject(project.id);
    await patchProject(project.id, { status: statusFor(project, project.trip_details, missing) });

    await insertMessage(project.id, 'assistant', reply + note, {
      intent: str(parsed.intent, 40),
      model: model.key,
      missing,
      suggestions,
      conflicts: merged.conflicts.length ? merged.conflicts : undefined,
      versionNo,
      changed: changed.slice(0, 20),
      usage: { input: usageIn, output: usageOut, weighted },
    });
    await finishJob(job.id, true);
    return { ok: true };
  } catch (e) {
    const err = e instanceof AiError ? e : e instanceof StudioError ? new AiError('provider', e.message) : new AiError('provider', (e as Error).message || 'Unexpected error');
    const retryable = err.retryable || ['malformed', 'empty', 'timeout', 'network', 'provider', 'rate_limit'].includes(err.code);
    const p = await loadProject(input.projectId).catch(() => null);
    await patchProject(input.projectId, {
      status: p?.current_version_id ? 'pdf_ready' : p ? statusFor(p, p.trip_details || {}, p.missing_fields || []) : 'failed',
      last_error: err.message,
    }).catch(() => undefined);
    await insertMessage(input.projectId, 'assistant', err.message, {
      error: { code: err.code, message: err.message, retryable },
      model: model.key,
    }).catch(() => undefined);
    await finishJob(job.id, false, err.message);
    return { ok: false, error: err.message, code: err.code };
  }
}

/* ─────────────────────────── deterministic operations (no AI) ─────────────────────────── */

export async function rerender(projectId: string, opts: { theme?: ThemeKey; themeOptions?: ThemeOptions; source?: string; label?: string | null }) {
  const settings = await getSettings();
  const project = await loadProject(projectId);
  if (!project.itinerary) {
    await patchProject(projectId, { theme: opts.theme || project.theme, theme_options: opts.themeOptions || project.theme_options });
    return null;
  }
  const job = await startJob(projectId, 'render', 'rendering');
  try {
    const v = await createVersion(settings, project, {
      itinerary: project.itinerary,
      theme: opts.theme || project.theme,
      themeOptions: opts.themeOptions || project.theme_options || {},
      source: opts.source || 'rerender',
      label: opts.label,
    });
    await finishJob(job.id, true);
    return v;
  } catch (e) {
    await finishJob(job.id, false, (e as Error).message);
    await patchProject(projectId, { last_error: (e as Error).message });
    throw e;
  }
}

export async function restoreVersion(projectId: string, versionId: string) {
  const { data: v } = await db().from('ai_itinerary_versions').select('*').eq('id', versionId).eq('project_id', projectId).maybeSingle();
  if (!v) throw new StudioError(404, 'not_found', 'Version not found');
  if (v.pdf_path && !(await getObject(v.pdf_path))) {
    // PDF missing from storage — re-render it from the saved content.
    const settings = await getSettings();
    const { buffer, pageCount } = await renderPdf(settings, v.itinerary, { ...settings.pdf.defaultOptions, ...v.theme_options }, { projectId });
    await putObject(v.pdf_path, buffer, 'application/pdf');
    await db().from('ai_itinerary_versions').update({ pdf_size: buffer.length, page_count: pageCount }).eq('id', v.id);
  }
  await patchProject(projectId, {
    itinerary: v.itinerary,
    theme: v.theme,
    theme_options: v.theme_options,
    current_version_id: v.id,
    itinerary_dirty: false,
    is_final: v.is_final,
    status: 'pdf_ready',
  });
  await insertMessage(projectId, 'system', `Restored version ${v.version_no}.`, { versionNo: v.version_no, intent: 'restore' });
  return v;
}

export async function saveManualItinerary(projectId: string, raw: unknown) {
  const v = validateItinerary(raw);
  if (!v.ok) throw new StudioError(400, 'invalid', v.errors.join('; '));
  await patchProject(projectId, { itinerary: v.value, itinerary_dirty: true, status: 'editing', is_final: false });
  return v.value;
}

export async function updateTripDetails(projectId: string, rawPatch: unknown, opts: { lock: boolean }) {
  const project = await loadProject(projectId);
  const patch = cleanTripPatch(rawPatch);
  const next: TripDetails = { ...(project.trip_details || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete (next as any)[k];
    else (next as any)[k] = v;
  }
  // Explicit null values for keys that cleanTripPatch dropped (e.g. empty strings) also clear the field.
  if (rawPatch && typeof rawPatch === 'object') {
    for (const [k, v] of Object.entries(rawPatch as Record<string, unknown>)) {
      if ((v === '' || v === null) && k in next) delete (next as any)[k];
    }
  }
  const locked = new Set(project.locked_fields || []);
  if (opts.lock) for (const k of Object.keys(rawPatch as object)) locked.add(k);
  const missing = (project.missing_fields || []).filter((m) => !(m.field in next));
  await patchProject(projectId, {
    trip_details: next,
    locked_fields: Array.from(locked),
    missing_fields: missing,
    destination: next.destination || null,
    duration_label: durationLabelOf(next),
    status: statusFor(project, next, missing),
  });
  return loadProject(projectId);
}

export async function deleteProjectFiles(projectId: string) {
  const [{ data: vers }, { data: refs }] = await Promise.all([
    db().from('ai_itinerary_versions').select('pdf_path').eq('project_id', projectId),
    db().from('ai_itinerary_references').select('storage_path').eq('project_id', projectId),
  ]);
  const paths = [...(vers || []).map((v: any) => v.pdf_path), ...(refs || []).map((r: any) => r.storage_path)].filter(Boolean);
  const { removeObjects } = await import('./assets');
  await removeObjects(paths);
}

export { BUCKET };
