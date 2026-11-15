'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowUp, Check, ChevronDown, ClipboardList, FileText, ImagePlus, Loader2, NotebookText, Paperclip, RefreshCw, Sparkles, Wand2, X, Zap,
} from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import {
  REFERENCE_PURPOSES, STAGE_LABELS, TRIP_FIELDS, canGenerate, fmtTokens, type MessageRow, type TripDetails, type ModelConfig, type ReferencePurpose, type ReferenceRow,
} from '@/lib/ai-itinerary/types';
import { BASE, LS, api, fmtBytes, type StudioState } from './api';
import { useStudio } from './StudioApp';
import { ConfirmDialog, Menu, StatusBadge, ghostBtn, iconBtn } from './ui';
import TripDetailsDrawer from './TripDetailsDrawer';
import ReferencesDrawer from './ReferencesDrawer';

export interface PendingSend { clientId: string; content: string; forceGenerate: boolean; startedAt: number }

type SendFn = (o: { content: string; forceGenerate?: boolean; referenceIds?: string[]; model?: string; priority?: boolean }) => Promise<boolean>;

const EXAMPLES = [
  'Create a 5-day Manali and Kasol itinerary for 12 people from Delhi. Overnight Volvo, 3-star hotel, breakfast and dinner, adventure activities, ₹6,000 per person.',
  'Make a 3D/2N Rishikesh trip for college students.',
  'Weekend Jaipur heritage trip for a corporate team of 25, starting Friday evening from Delhi.',
];

const FIELD_LABEL = Object.fromEntries(TRIP_FIELDS.map((f) => [f.key, f.label]));

function estimateWeighted(state: StudioState | null, model: ModelConfig | undefined, generate: boolean, draftLen: number) {
  if (!model) return null;
  const ctxChars = JSON.stringify(state?.project.trip_details || {}).length + JSON.stringify(state?.project.itinerary || {}).length
    + (state?.messages || []).slice(-10).reduce((s, m) => s + Math.min(2000, m.content.length), 0) + draftLen;
  const input = 2700 + Math.ceil(ctxChars / 4);
  const output = generate ? 5000 : 600;
  return Math.round((input + output) * model.multiplier);
}

interface Attachment { localId: string; name: string; size: number; status: 'uploading' | 'processing' | 'ready' | 'failed'; ref?: ReferenceRow; error?: string; purpose: ReferencePurpose; preview?: string }

export default function ChatPanel({
  state, loading, loadError, onRetryLoad, pending, onSend, onPatch, onReload, leftToggle, rightToggle, onShowPreview,
}: {
  state: StudioState | null;
  loading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  pending: PendingSend | null;
  onSend: SendFn;
  onPatch: (body: Record<string, unknown>, msg?: string) => Promise<boolean>;
  onReload: () => Promise<void>;
  leftToggle: React.ReactNode;
  rightToggle: React.ReactNode;
  onShowPreview: () => void;
}) {
  const { settings, projectId, openProject } = useStudio();
  const { toast } = useAdminLive();
  const project = state?.project || null;
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [confirmGen, setConfirmGen] = useState<{ est: number } | null>(null);
  const [priority, setPriority] = useState(false);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pdfPurposeAsk, setPdfPurposeAsk] = useState(false);
  const [pdfPurpose, setPdfPurpose] = useState<ReferencePurpose>('auto');

  const models = settings?.settings.pricing.models || [];
  const defaultModel = settings?.settings.ai.defaultModel;
  const usable = (m?: ModelConfig) => !!m && m.enabled && m.verified;
  const currentModel = useMemo(() => {
    const want = modelKey || project?.model || LS.get('gk_ais_model') || defaultModel;
    const m = models.find((x) => x.key === want);
    return usable(m) ? m : models.find((x) => x.key === defaultModel && usable(x)) || models.find(usable);
  }, [modelKey, project?.model, models, defaultModel]);

  // Draft autosave per project (local convenience only).
  const draftKey = `gk_ais_draft_${projectId || 'new'}`;
  useEffect(() => { setDraft(LS.get(draftKey) || ''); setAttachments([]); setModelKey(null); }, [draftKey]);
  useEffect(() => { const t = setTimeout(() => (draft ? LS.set(draftKey, draft) : LS.del(draftKey)), 300); return () => clearTimeout(t); }, [draft, draftKey]);

  // Auto-size the composer.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(220, ta.scrollHeight)}px`;
  }, [draft]);

  const messages = state?.messages || [];
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending?.clientId, state?.job?.stage]);

  const job = state?.job;
  const working = !!pending || !!job;
  const stage = job?.stage ? STAGE_LABELS[job.stage] || 'Working' : pending?.forceGenerate ? STAGE_LABELS.generating : STAGE_LABELS.thinking;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!working) return;
    const start = pending?.startedAt || (job ? new Date(job.started_at).getTime() : Date.now());
    const t = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [working, pending?.startedAt, job]);

  /* ── attachments ── */
  const upload = useCallback(async (files: File[], purpose: ReferencePurpose = 'auto') => {
    if (!files.length) return;
    let pid = projectId;
    if (!pid) {
      try {
        const r = await api<{ project: { id: string } }>('/projects', { method: 'POST', json: {} });
        pid = r.project.id;
        openProject(pid);
      } catch (e) { toast((e as Error).message, 'error'); return; }
    }
    const docMB = settings?.settings.references.maxFileMB || 10;
    for (const f of files.slice(0, 12)) {
      const localId = `${Date.now()}-${f.name}`;
      const isImage = f.type.startsWith('image/');
      const maxMB = isImage ? Math.max(docMB, 15) : docMB;
      if (f.size > maxMB * 1024 * 1024) { toast(`${f.name} is larger than ${maxMB} MB`, 'error'); continue; }
      setAttachments((a) => [...a, { localId, name: f.name, size: f.size, status: 'uploading', purpose: isImage ? 'photo' : purpose, preview: isImage ? URL.createObjectURL(f) : undefined }]);
      const fd = new FormData();
      fd.append('file', f);
      fd.append('purpose', isImage ? 'photo' : purpose);
      try {
        const res = await fetch(`${BASE}/projects/${pid}/references`, { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Upload failed');
        const ref = j.reference as ReferenceRow;
        setAttachments((a) => a.map((x) => (x.localId === localId ? { ...x, status: ref.status === 'failed' ? 'failed' : 'ready', ref, error: ref.error || undefined } : x)));
        if (ref.status === 'failed') toast(`${f.name}: ${ref.error || 'could not be read'}`, 'error');
      } catch (e) {
        setAttachments((a) => a.map((x) => (x.localId === localId ? { ...x, status: 'failed', error: (e as Error).message } : x)));
        toast((e as Error).message, 'error');
      }
    }
    onReload();
  }, [projectId, openProject, settings, toast, onReload]);

  const setPurpose = async (att: Attachment, purpose: ReferencePurpose) => {
    setAttachments((a) => a.map((x) => (x.localId === att.localId ? { ...x, purpose } : x)));
    if (att.ref && projectId) await api(`/projects/${projectId}/references/${att.ref.id}`, { method: 'PATCH', json: { purpose } }).catch(() => undefined);
  };

  /* ── sending ── */
  const doSend = async (opts: { content?: string; forceGenerate?: boolean } = {}) => {
    const content = (opts.content ?? draft).trim();
    if (working) return;
    if (!content && !opts.forceGenerate) return;
    if (attachments.some((a) => a.status === 'uploading')) { toast('Wait for uploads to finish', 'info'); return; }
    const referenceIds = attachments.filter((a) => a.status === 'ready' && a.ref).map((a) => a.ref!.id);
    if (opts.content === undefined) { setDraft(''); LS.del(draftKey); }
    const sent = attachments;
    setAttachments([]);
    const ok = await onSend({ content, forceGenerate: opts.forceGenerate, referenceIds, model: currentModel?.key, priority });
    if (!ok && opts.content === undefined) { setDraft(content); setAttachments(sent); }
  };

  const requestGenerate = () => {
    const est = estimateWeighted(state, currentModel, true, draft.length);
    const warn = settings?.settings.ai.warnAboveWeighted || 0;
    if (est != null && warn > 0 && est > warn) setConfirmGen({ est });
    else doSend({ content: draft.trim(), forceGenerate: true });
  };

  const retry = (m: MessageRow) => {
    const idx = messages.findIndex((x) => x.id === m.id);
    const lastUser = [...messages.slice(0, idx)].reverse().find((x) => x.role === 'user');
    if (lastUser) doSend({ content: lastUser.content, forceGenerate: lastUser.meta?.intent === 'generate' });
  };

  const chooseModel = async (m: ModelConfig) => {
    setModelKey(m.key);
    LS.set('gk_ais_model', m.key);
    if (project) await onPatch({ model: m.key });
  };

  const tripCount = project ? Object.keys(project.trip_details || {}).length : 0;
  const ready = project ? canGenerate(project.trip_details || {}) : false;
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const noKey = settings && !settings.apiKey.configured;
  const noModel = settings && !currentModel;

  return (
    <section
      className="relative flex h-full min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(Array.from(e.dataTransfer.files)); }}
    >
      {/* header */}
      <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        {leftToggle}
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-[13.5px] font-bold text-slate-900">{project?.title || 'New itinerary'}</p>
          {project && (
            <p className="flex items-center gap-1.5 truncate text-[11.5px] text-slate-500">
              <StatusBadge status={project.status} final={project.is_final} dirty={project.itinerary_dirty} small />
              {project.destination && <span className="truncate">{project.destination}{project.duration_label ? ` · ${project.duration_label}` : ''}</span>}
            </p>
          )}
        </div>
        {project && (
          <>
            <button type="button" onClick={() => setDetailsOpen(true)} className={ghostBtn} title="Trip details">
              <ClipboardList className="h-4 w-4" /><span className="hidden xl:inline">Trip details</span>
              {tripCount > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{tripCount}</span>}
            </button>
            <button type="button" onClick={() => setRefsOpen(true)} className={ghostBtn} title="Reference files">
              <Paperclip className="h-4 w-4" />
              {(state?.references.length || 0) > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{state?.references.length}</span>}
            </button>
          </>
        )}
        {rightToggle}
      </header>

      {/* messages */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
        {loading && (
          <div className="space-y-4" aria-busy="true">
            <div className="sk sk-soft ml-auto h-12 w-2/3 rounded-2xl" />
            <div className="sk sk-soft h-20 w-3/4 rounded-2xl" />
          </div>
        )}
        {loadError && (
          <div className="mx-auto mt-8 max-w-sm rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn’t load this itinerary: {loadError}
            <button type="button" onClick={onRetryLoad} className="ml-2 font-semibold underline">Retry</button>
          </div>
        )}
        {!loading && !loadError && messages.length === 0 && !pending && (
          <div className="mx-auto flex h-full max-w-lg flex-col justify-center py-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Sparkles className="h-5 w-5" /></span>
            <h2 className="mt-3 text-lg font-bold text-slate-950">What trip are we planning?</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Describe it in any form — a full brief, rough notes, day-by-day lines, or attach an old PDF. I’ll capture the details, ask only what’s essential, and build the PDF.
            </p>
            <div className="mt-5 space-y-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => { setDraft(ex); taRef.current?.focus(); }} className="block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-[13px] leading-snug text-slate-600 transition hover:border-purple-300 hover:bg-purple-50/40 hover:text-slate-900">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        <ol className="space-y-4">
          {messages.map((m) => (
            <MessageItem
              key={m.id}
              m={m}
              isLast={m.id === lastAssistant?.id && !working}
              onSuggestion={(s) => (/generate/i.test(s) && /available/i.test(s) ? requestGenerate() : doSend({ content: s }))}
              onRetry={() => retry(m)}
              onShowPreview={onShowPreview}
              onAcceptConflict={async (field, value) => {
                await onPatch({ tripDetails: { [field]: value }, lock: true }, `${FIELD_LABEL[field] || field} updated`);
              }}
              onOpenDetails={() => setDetailsOpen(true)}
              tripDetails={project?.trip_details}
            />
          ))}
          {pending && (
            <li className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-purple-600 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white opacity-80">{pending.content}</div>
            </li>
          )}
          {working && (
            <li className="flex items-center gap-2.5" role="status">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /></span>
              <span className="text-[13px] font-medium text-slate-600">{stage}…</span>
              <span className="text-[11.5px] tabular-nums text-slate-400">{elapsed}s</span>
            </li>
          )}
        </ol>
      </div>

      {/* composer */}
      <div className="border-t border-slate-100 p-2.5 sm:p-3">
        {(noKey || noModel) && (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {noKey ? 'The Codex.sale API key isn’t configured on the server (CODEX_API_KEY). You can browse and re-render PDFs, but AI requests will fail.' : 'No verified model is enabled. Verify one in Settings → Advanced.'}
          </div>
        )}
        {project && ready && !working && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={requestGenerate} disabled={!!noKey || !!noModel} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 text-[12px] font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50">
              <Wand2 className="h-3.5 w-3.5" />
              {project.itinerary ? 'Regenerate from details' : 'Generate with available details'}
            </button>
            {currentModel && <span className="text-[11px] text-slate-400">≈ {fmtTokens(estimateWeighted(state, currentModel, true, draft.length))} weighted tokens (estimate)</span>}
          </div>
        )}
        {attachments.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <li key={a.localId} className={`flex items-center gap-1.5 rounded-lg border py-1 pl-2 pr-1 text-[12px] ${a.status === 'failed' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`} title={a.error}>
                {a.preview
                  ? <span className="relative h-7 w-7 overflow-hidden rounded-md bg-slate-200">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={a.preview} alt="" className="h-full w-full object-cover" />{a.status === 'uploading' && <span className="absolute inset-0 flex items-center justify-center bg-white/60"><Loader2 className="h-3.5 w-3.5 animate-spin" /></span>}</span>
                  : a.status === 'uploading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : a.status === 'failed' ? <AlertTriangle className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5 text-purple-600" />}
                <span className="max-w-[140px] truncate font-medium">{a.name}</span>
                <span className="text-slate-400">{fmtBytes(a.size)}</span>
                {a.status === 'ready' && a.purpose === 'photo' && <span className="rounded bg-purple-50 px-1.5 text-[11px] font-semibold text-purple-700">Photo for PDF</span>}
                {a.status === 'ready' && a.purpose !== 'photo' && (
                  <select value={a.purpose} onChange={(e) => setPurpose(a, e.target.value as ReferencePurpose)} aria-label="Reference purpose" className="h-6 max-w-[150px] rounded-md border border-slate-200 bg-white px-1 text-[11.5px] outline-none">
                    {REFERENCE_PURPOSES.filter((p) => p.key !== 'photo').map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                )}
                <button type="button" onClick={() => setAttachments((x) => x.filter((y) => y.localId !== a.localId))} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={`Remove ${a.name}`}><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-xl border border-slate-200 bg-white transition focus-within:border-purple-400 focus-within:ring-4 focus-within:ring-purple-100">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); doSend(); }
            }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files || []);
              if (files.length) { e.preventDefault(); upload(files); }
            }}
            rows={1}
            placeholder={project?.itinerary ? 'Ask for a change — e.g. “Change Day 2 rafting to a waterfall visit”' : 'Describe the trip, paste notes, or add day-by-day details…'}
            className="block max-h-[220px] min-h-[44px] w-full resize-none bg-transparent px-3.5 pt-3 text-[13.5px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Message"
          />
          <div className="flex items-center gap-1 px-2 pb-2 pt-1">
            <input ref={fileRef} type="file" multiple accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
            <input ref={photoRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
            <input ref={pdfRef} type="file" multiple accept=".pdf,application/pdf" className="hidden" onChange={(e) => { upload(Array.from(e.target.files || []), pdfPurpose); e.target.value = ''; }} />
            <Menu
              align="left"
              width="w-64"
              trigger={({ toggle, open }) => (
                <button type="button" onClick={toggle} aria-expanded={open} className={iconBtn} aria-label="Attach" title="Attach photos, a reference PDF or notes (or drop files here)"><Paperclip className="h-4 w-4" /></button>
              )}
            >
              {(close) => (
                <>
                  <button type="button" onClick={() => { close(); photoRef.current?.click(); }} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50">
                    <ImagePlus className="mt-0.5 h-4 w-4 text-purple-600" />
                    <span><span className="block text-[13px] font-semibold text-slate-800">Photos for the PDF</span><span className="block text-[11.5px] text-slate-500">Cover, day pages and gallery (JPG, PNG, WebP)</span></span>
                  </button>
                  <button type="button" onClick={() => { close(); setPdfPurposeAsk(true); }} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50">
                    <FileText className="mt-0.5 h-4 w-4 text-purple-600" />
                    <span><span className="block text-[13px] font-semibold text-slate-800">Reference PDF</span><span className="block text-[11.5px] text-slate-500">Old itinerary, other agency PDF or design inspiration</span></span>
                  </button>
                  <button type="button" onClick={() => { close(); fileRef.current?.click(); }} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50">
                    <NotebookText className="mt-0.5 h-4 w-4 text-purple-600" />
                    <span><span className="block text-[13px] font-semibold text-slate-800">Notes</span><span className="block text-[11.5px] text-slate-500">.txt or .md trip notes</span></span>
                  </button>
                </>
              )}
            </Menu>
            <ModelPicker models={models} current={currentModel} onChoose={chooseModel} priority={priority} setPriority={setPriority} />
            <span className="ml-auto hidden truncate text-[11px] text-slate-400 2xl:inline">Enter to send · Shift+Enter for a new line</span>
            <button
              type="button"
              onClick={() => doSend()}
              disabled={working || !draft.trim()}
              className="ml-auto inline-flex flex-shrink-0 2xl:ml-2 h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-sm transition hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              aria-label="Send message"
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {dragOver && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-purple-400 bg-purple-50/90 text-sm font-semibold text-purple-700">
          Drop photos, PDFs or notes to attach
        </div>
      )}

      {project && <TripDetailsDrawer open={detailsOpen} onClose={() => setDetailsOpen(false)} project={project} onPatch={onPatch} />}
      {project && state && <ReferencesDrawer open={refsOpen} onClose={() => setRefsOpen(false)} projectId={project.id} references={state.references} dayCount={project.itinerary?.days.length || project.trip_details?.durationDays || 1} hasPdf={!!project.current_version_id} onReload={onReload} onUpload={upload} />}
      <ConfirmDialog
        open={pdfPurposeAsk}
        title="What is this PDF for?"
        confirmLabel="Choose PDF"
        body={
          <div className="mt-2 max-h-[55vh] space-y-1.5 overflow-y-auto">
            {REFERENCE_PURPOSES.filter((p) => p.key !== 'photo').map((p) => (
              <label key={p.key} className={`flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2 ${pdfPurpose === p.key ? 'border-purple-400 bg-purple-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="pdf-purpose" className="mt-0.5 accent-purple-600" checked={pdfPurpose === p.key} onChange={() => setPdfPurpose(p.key)} />
                <span><span className="block text-[13px] font-semibold text-slate-800">{p.label}</span><span className="block text-[11.5px] leading-snug text-slate-500">{p.hint}</span></span>
              </label>
            ))}
          </div>
        }
        onConfirm={() => { setPdfPurposeAsk(false); setTimeout(() => pdfRef.current?.click(), 0); }}
        onClose={() => setPdfPurposeAsk(false)}
      />
      <ConfirmDialog
        open={!!confirmGen}
        title="Generate the itinerary?"
        body={<>This is a large request — roughly <b>{fmtTokens(confirmGen?.est)}</b> weighted tokens on {currentModel?.displayName} (local estimate; actual usage is recorded from the API response).</>}
        confirmLabel="Generate"
        onConfirm={() => { setConfirmGen(null); doSend({ content: draft.trim(), forceGenerate: true }); }}
        onClose={() => setConfirmGen(null)}
      />
    </section>
  );
}

/* ─────────────────────────── message ─────────────────────────── */

function MessageItem({
  m, isLast, onSuggestion, onRetry, onShowPreview, onAcceptConflict, onOpenDetails, tripDetails,
}: {
  m: MessageRow; isLast: boolean; onSuggestion: (s: string) => void; onRetry: () => void; onShowPreview: () => void;
  onAcceptConflict: (field: string, value: unknown) => Promise<void>; onOpenDetails: () => void; tripDetails?: TripDetails;
}) {
  const [accepted, setAccepted] = useState<string[]>([]);
  if (m.role === 'system') {
    return <li className="text-center text-[11.5px] font-medium text-slate-400">{m.content}</li>;
  }
  if (m.role === 'user') {
    return (
      <li className="flex flex-col items-end gap-1">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-purple-600 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">{m.content}</div>
        {!!m.meta?.attachments?.length && (
          <div className="flex flex-wrap justify-end gap-1">
            {m.meta.attachments.map((a) => <span key={a.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"><FileText className="h-3 w-3" />{a.filename}</span>)}
          </div>
        )}
      </li>
    );
  }
  const err = m.meta?.error;
  return (
    <li className="flex gap-2.5">
      <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${err ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
        {err ? <AlertTriangle className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50/70 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-800">
            <p>{m.content}</p>
            <p className="mt-1 text-[11.5px] text-red-700/80">Your conversation and details are saved.</p>
            {err.retryable && isLast && (
              <button type="button" onClick={onRetry} className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-[12px] font-semibold text-red-700 hover:bg-red-50">
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-slate-800">{m.content}</div>
        )}

        {m.meta?.versionNo && (
          <button type="button" onClick={onShowPreview} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-800 hover:bg-emerald-100">
            <FileText className="h-3.5 w-3.5" /> PDF version {m.meta.versionNo} ready
          </button>
        )}

        {!!m.meta?.changed?.length && !m.meta.versionNo && (
          <button type="button" onClick={onOpenDetails} className="mt-1.5 text-[11.5px] font-medium text-slate-500 hover:text-purple-700">
            Captured: {m.meta.changed.filter((c) => c !== 'itinerary').map((c) => FIELD_LABEL[c] || c).slice(0, 6).join(', ')}
          </button>
        )}

        {!!m.meta?.conflicts?.length && (
          <div className="mt-2 space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5">
            <p className="text-[12px] font-semibold text-amber-900">You confirmed these manually, so I didn’t change them:</p>
            {m.meta.conflicts.map((c) => (
              <div key={c.field} className="flex flex-wrap items-center gap-2 text-[12px] text-amber-900">
                <span className="font-semibold">{FIELD_LABEL[c.field] || c.field}:</span>
                <span className="line-through opacity-70">{fmtVal(c.current)}</span>
                <span>→ {fmtVal(c.proposed)}</span>
                {accepted.includes(c.field) || JSON.stringify((tripDetails as any)?.[c.field] ?? null) === JSON.stringify(c.proposed ?? null) ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" />Applied</span>
                ) : (
                  <button type="button" onClick={async () => { await onAcceptConflict(c.field, c.proposed); setAccepted((a) => [...a, c.field]); }} className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-semibold hover:bg-amber-100">Apply</button>
                )}
              </div>
            ))}
          </div>
        )}

        {isLast && !!m.meta?.suggestions?.length && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {m.meta.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => onSuggestion(s)} className="rounded-full border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800">{s}</button>
            ))}
          </div>
        )}

        {m.meta?.usage && (m.meta.usage.weighted != null || m.meta.model) && (
          <p className="mt-1.5 text-[10.5px] text-slate-400">
            {m.meta.model}{m.meta.usage.input != null ? ` · ${fmtTokens(m.meta.usage.input)} in / ${fmtTokens(m.meta.usage.output)} out · ${fmtTokens(m.meta.usage.weighted)} weighted` : ' · usage not reported'}
          </p>
        )}
      </div>
    </li>
  );
}

function fmtVal(v: unknown): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.map((x: any) => (typeof x === 'object' ? `Day ${x.day}` : String(x))).join(', ');
  return String(v).slice(0, 80);
}

/* ─────────────────────────── model picker ─────────────────────────── */

function ModelPicker({ models, current, onChoose, priority, setPriority }: { models: ModelConfig[]; current?: ModelConfig; onChoose: (m: ModelConfig) => void; priority: boolean; setPriority: (v: boolean) => void }) {
  return (
    <Menu
      align="left"
      width="w-80"
      trigger={({ toggle, open }) => (
        <button type="button" onClick={toggle} aria-expanded={open} title="Model for the next requests" className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-100 ${open ? 'bg-slate-100' : ''}`}>
          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          {current ? current.displayName : 'No model'}
          {current && <span className="font-normal text-slate-400">{current.multiplier}×</span>}
          {priority && current?.supportsPriority && <Zap className="h-3 w-3 text-amber-500" />}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-[360px] overflow-y-auto">
          <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Model for next requests</p>
          {models.map((m) => {
            const usable = m.enabled && m.verified;
            const active = current?.key === m.key;
            return (
              <button
                key={m.key}
                type="button"
                disabled={!usable}
                onClick={() => { onChoose(m); close(); }}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left transition disabled:cursor-not-allowed ${active ? 'bg-purple-50' : usable ? 'hover:bg-slate-50' : 'opacity-60'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
                    {m.displayName}
                    <span className="font-normal text-slate-400">{m.multiplier}×</span>
                    {!m.verified ? <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">Unverified</span> : !m.enabled ? <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">Disabled</span> : null}
                  </span>
                  <span className="block font-mono text-[10.5px] text-slate-400">{m.apiId}</span>
                  {m.recommended && <span className="block text-[11.5px] leading-snug text-slate-500">{m.recommended}</span>}
                </span>
                {active && <Check className="mt-0.5 h-4 w-4 text-purple-600" />}
              </button>
            );
          })}
          {current?.supportsPriority && (
            <label className="flex cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-2 text-[12.5px] text-slate-700">
              <input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} className="accent-purple-600" />
              Priority mode <span className="text-slate-400">(2× tokens)</span>
            </label>
          )}
          <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-400">Unverified models are enabled after a successful test or model discovery in Settings → Advanced.</p>
        </div>
      )}
    </Menu>
  );
}
