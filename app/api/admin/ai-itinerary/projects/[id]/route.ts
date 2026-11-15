import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, json, readJson } from '@/lib/ai-itinerary/http';
import { getSettings } from '@/lib/ai-itinerary/settings';
import { cleanThemeOptions, isThemeKey, str } from '@/lib/ai-itinerary/schema';
import {
  StudioError,
  deleteProjectFiles,
  loadProject,
  reapStaleJobs,
  rerender,
  saveManualItinerary,
  updateTripDetails,
} from '@/lib/ai-itinerary/service';
import { TRIP_FIELD_KEYS } from '@/lib/ai-itinerary/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Full studio state for one project: project, messages, versions, references, running job. */
export const GET = adminRoute(async ({ params }) => {
  const db = createAdminClient();
  const settings = await getSettings();
  await reapStaleJobs(params.id, settings);
  const project = await loadProject(params.id);
  const [msgs, vers, refs, job] = await Promise.all([
    db.from('ai_itinerary_messages').select('*').eq('project_id', params.id).order('created_at', { ascending: true }).limit(400),
    db.from('ai_itinerary_versions')
      .select('id, project_id, version_no, source, label, theme, theme_options, pdf_size, page_count, model, is_final, created_at')
      .eq('project_id', params.id)
      .order('version_no', { ascending: false }),
    db.from('ai_itinerary_references')
      .select('id, project_id, filename, mime_type, size_bytes, purpose, status, page_count, error, created_at, kind, image_role, image_day, caption, meta')
      .eq('project_id', params.id)
      .order('created_at', { ascending: true }),
    db.from('ai_generation_jobs').select('*').eq('project_id', params.id).eq('status', 'running').maybeSingle(),
  ]);
  return json({
    project,
    messages: msgs.data || [],
    versions: vers.data || [],
    references: refs.data || [],
    job: job.data || null,
  });
});

/**
 * Deterministic updates (no AI): rename, archive, model, theme (+ optional re-render),
 * trip-details edits (locks edited fields), unlock, accept conflict, manual itinerary edits.
 */
export const PATCH = adminRoute(async ({ req, params }) => {
  const body = await readJson(req);
  const db = createAdminClient();
  const project = await loadProject(params.id);
  const patch: Record<string, unknown> = {};

  if ('title' in body) {
    const t = str(body.title, 140);
    if (!t) throw new StudioError(400, 'invalid', 'Title is required');
    patch.title = t;
  }
  if ('archived' in body) patch.archived_at = body.archived ? new Date().toISOString() : null;
  if ('model' in body && typeof body.model === 'string') patch.model = body.model.slice(0, 60);

  if (body.tripDetails && typeof body.tripDetails === 'object') {
    const keys = Object.keys(body.tripDetails).filter((k) => TRIP_FIELD_KEYS.includes(k as any));
    const clean = Object.fromEntries(keys.map((k) => [k, body.tripDetails[k]]));
    await updateTripDetails(params.id, clean, { lock: body.lock !== false });
  }
  if (typeof body.unlock === 'string') {
    patch.locked_fields = (project.locked_fields || []).filter((f) => f !== body.unlock);
  }
  if (body.itinerary) {
    await saveManualItinerary(params.id, body.itinerary);
  }
  if (typeof body.finalize === 'boolean' && project.current_version_id) {
    await db.from('ai_itinerary_versions').update({ is_final: false }).eq('project_id', params.id);
    if (body.finalize) await db.from('ai_itinerary_versions').update({ is_final: true }).eq('id', project.current_version_id);
    patch.is_final = body.finalize;
  }

  if (Object.keys(patch).length) {
    const { error } = await db.from('ai_itinerary_projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', params.id);
    if (error) throw new StudioError(500, 'db', error.message);
  }

  if ('theme' in body || 'themeOptions' in body) {
    const theme = isThemeKey(body.theme) ? body.theme : project.theme;
    const themeOptions = 'themeOptions' in body ? cleanThemeOptions(body.themeOptions) : project.theme_options;
    const fresh = await loadProject(params.id);
    if (body.render !== false && fresh.itinerary) {
      await rerender(params.id, { theme, themeOptions, source: 'theme' });
    } else {
      await db.from('ai_itinerary_projects').update({ theme, theme_options: themeOptions, updated_at: new Date().toISOString() }).eq('id', params.id);
    }
  }
  return json({ project: await loadProject(params.id) });
});

export const DELETE = adminRoute(async ({ params }) => {
  await loadProject(params.id);
  await deleteProjectFiles(params.id).catch(() => undefined);
  const db = createAdminClient();
  const { error } = await db.from('ai_itinerary_projects').delete().eq('id', params.id);
  if (error) throw new StudioError(500, 'db', error.message);
  return json({ ok: true });
});
