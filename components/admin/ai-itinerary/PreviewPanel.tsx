'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BadgeCheck, ChevronLeft, ChevronRight, Download, FileText, History, Loader2, Maximize2, Minimize2, MoreHorizontal, Palette, Dices,
  Printer, RefreshCw, Save, Sparkles, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { STAGE_LABELS } from '@/lib/ai-itinerary/types';
import { MOODS, newSeed, resolveDesign } from '@/lib/ai-itinerary/design';
import { api, downloadPdf, pdfUrl, type StudioState } from './api';
import { ConfirmDialog, EmptyState, Menu, MenuItem, StatusBadge, iconBtn, smallPrimary } from './ui';
import ItineraryView from './ItineraryView';
import DesignDrawer from './DesignDrawer';
import VersionsDrawer from './VersionsDrawer';
import PdfViewer, { type PdfViewerHandle } from './PdfViewer';

type View = 'pdf' | 'itinerary';
const ZOOMS = [50, 75, 100, 125, 150, 200];

export default function PreviewPanel({
  state, running, onReload, onPatch, onSend,
}: {
  state: StudioState | null;
  running: boolean;
  onReload: () => Promise<void>;
  onPatch: (body: Record<string, unknown>, msg?: string) => Promise<boolean>;
  onSend: (o: { content: string; forceGenerate?: boolean }) => Promise<boolean>;
}) {
  const { toast } = useAdminLive();
  const project = state?.project || null;
  const versions = state?.versions || [];
  const [view, setView] = useState<View>('pdf');
  const [viewVersionId, setViewVersionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [full, setFull] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [saveLabel, setSaveLabel] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PdfViewerHandle>(null);
  const [loadedPages, setLoadedPages] = useState<number | null>(null);

  const currentId = project?.current_version_id || null;
  const shownId = viewVersionId && versions.some((v) => v.id === viewVersionId) ? viewVersionId : currentId;
  const shown = versions.find((v) => v.id === shownId) || null;
  const pages = loadedPages || shown?.page_count || 1;

  useEffect(() => { setViewVersionId(null); setPage(1); setEditorDirty(false); }, [project?.id]);
  useEffect(() => { setPage(1); setLoadedPages(null); }, [shownId]);
  const goPage = (n: number) => { const p = Math.min(pages, Math.max(1, n)); setPage(p); viewerRef.current?.goTo(p); };
  useEffect(() => { if (!currentId && project?.itinerary) setView('itinerary'); }, [currentId, project?.itinerary]);

  // Fullscreen
  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === boxRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else boxRef.current?.requestFullscreen?.().catch(() => toast('Fullscreen is not available here', 'info'));
  };

  // Print through the browser's own PDF viewer when it has one; otherwise open the PDF in a new tab.
  const print = () => {
    if (!shownId) return;
    const hasViewer = (navigator as any).pdfViewerEnabled !== false;
    if (!hasViewer) { window.open(pdfUrl(shownId), '_blank', 'noopener'); return; }
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.src = pdfUrl(shownId);
    frame.onload = () => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
      catch { window.open(pdfUrl(shownId), '_blank', 'noopener'); }
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  };

  const download = async () => {
    if (!shownId) return;
    setBusy('download');
    try { await downloadPdf(shownId); }
    catch (e) { toast('Download failed', 'error', { sub: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const render = useCallback(async (body: Record<string, unknown> = {}, msg = 'PDF updated') => {
    if (!project) return;
    setBusy('render');
    try {
      await api(`/projects/${project.id}/render`, { method: 'POST', json: body });
      toast(msg);
      setViewVersionId(null);
      setView('pdf');
      await onReload();
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(null); }
  }, [project, onReload, toast]);

  const finalize = async (v: boolean) => {
    if (!project) return;
    await onPatch({ finalize: v }, v ? 'Marked as final' : 'Final mark removed');
  };

  const stage = state?.job?.stage ? STAGE_LABELS[state.job.stage] : null;
  const isOutdated = !!project?.itinerary_dirty;
  const photoCount = (state?.references || []).filter((r) => r.kind === 'image' && r.status === 'ready' && r.image_role !== 'exclude').length;
  const spec = project ? resolveDesign(project.theme_options?.design, { photoCount, dayCount: project.itinerary?.days.length || 3, legacyTheme: project.id }) : null;
  const designLabel = spec ? `${MOODS.find((m) => m.key === spec.mood)?.label} · ${spec.palette.name}` : '';
  const shuffle = async () => {
    if (!project) return;
    const prev = project.theme_options?.design || {};
    setBusy('render');
    await onPatch({ themeOptions: { ...(project.theme_options || {}), design: { ...prev, seed: newSeed(), cover: undefined, motif: undefined, dayStyle: undefined } } }, 'New design rendered — no AI tokens used');
    setBusy(null);
    setViewVersionId(null);
    setView('pdf');
  };

  /* ── empty / waiting states ── */
  const body = (() => {
    if (!project) {
      return <EmptyState icon={FileText} title="Your PDF appears here" body="Start a conversation — once the itinerary is generated, you can preview, edit, re-theme and download it here." />;
    }
    if (!project.itinerary && !currentId) {
      return running ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" role="status">
          <div className="w-full max-w-xs space-y-2">
            <div className="sk sk-purple h-28 rounded-xl" />
            <div className="sk sk-soft h-3 w-3/4 rounded" />
            <div className="sk sk-soft h-3 w-1/2 rounded" />
          </div>
          <p className="text-[13px] font-semibold text-slate-600">{stage || 'Working'}…</p>
        </div>
      ) : (
        <div className="flex h-full flex-col justify-center px-6">
          <EmptyState icon={Sparkles} title="No itinerary yet" body="Share the trip details in the chat. When the essentials are in, press “Generate with available details” — or just say “generate”." />
          <ol className="mx-auto mt-2 max-w-xs space-y-2 text-[12.5px] text-slate-500">
            {['Describe the trip in any form', 'Answer only the essential questions', 'Generate, then refine by chat or editing', 'Switch themes for free, download the PDF'].map((s, i) => (
              <li key={s} className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{i + 1}</span>{s}</li>
            ))}
          </ol>
        </div>
      );
    }
    if (view === 'itinerary' && project.itinerary) {
      return (
        <ItineraryView
          key={project.id + (project.updated_at || '')}
          project={project}
          onDirtyChange={setEditorDirty}
          onSave={async (it) => {
            const ok = await onPatch({ itinerary: it }, 'Draft saved — update the PDF when ready');
            if (ok) setEditorDirty(false);
            return ok;
          }}
        />
      );
    }
    if (!shownId) {
      return <EmptyState icon={FileText} title="No PDF rendered yet" body="Render the current itinerary to create the first PDF version." action={<button className={smallPrimary} onClick={() => render({}, 'PDF rendered')}>Render PDF</button>} />;
    }
    return (
      <div className="relative h-full bg-slate-100">
        <PdfViewer ref={viewerRef} url={pdfUrl(shownId)} zoom={zoom} onPageCount={setLoadedPages} onPageChange={setPage} />
        {(running || busy === 'render') && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-white/90 py-2 text-[12.5px] font-semibold text-purple-700 backdrop-blur" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {busy === 'render' ? 'Rendering PDF' : stage || 'Working'}…
          </div>
        )}
      </div>
    );
  })();

  return (
    <section ref={boxRef} className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white ${full ? 'rounded-none' : ''}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <div role="tablist" className="flex rounded-lg bg-slate-100 p-0.5">
          {(['pdf', 'itinerary'] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} disabled={!project} onClick={() => setView(v)} className={`h-7 rounded-md px-2.5 text-[12.5px] font-semibold transition ${view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {v === 'pdf' ? 'PDF' : 'Itinerary'}
            </button>
          ))}
        </div>
        {project && (
          <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-slate-500">
            {editorDirty ? <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Unsaved changes</span>
              : currentId || project.itinerary ? <StatusBadge status={project.status} final={project.is_final && !isOutdated} dirty={isOutdated} small /> : null}
            {shown && <span className="truncate">v{shown.version_no}{shown.id !== currentId ? ' (older)' : ''} · {designLabel}</span>}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          {project?.itinerary && (
            <>
              <button type="button" className={iconBtn} title="Shuffle design (new layout, same content, no AI tokens)" onClick={shuffle} disabled={busy === 'render' || running}><Dices className="h-4 w-4" /></button>
              <button type="button" className={iconBtn} title="Design: mood, fonts, colours, cover, layout" onClick={() => setThemeOpen(true)}><Palette className="h-4 w-4" /></button>
              <button type="button" className={iconBtn} title="Version history" onClick={() => setVersionsOpen(true)} disabled={!versions.length}><History className="h-4 w-4" /></button>
            </>
          )}
          {shownId && (
            <button type="button" onClick={download} disabled={busy === 'download'} className={smallPrimary} title="Download PDF">
              {busy === 'download' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}<span className="hidden sm:inline">Download</span>
            </button>
          )}
          {project?.itinerary && (
            <Menu width="w-56" trigger={({ toggle }) => <button type="button" onClick={toggle} className={iconBtn} aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></button>}>
              {(close) => (
                <>
                  <MenuItem icon={RefreshCw} onClick={() => { close(); render({}, 'PDF re-rendered'); }}>Re-render PDF</MenuItem>
                  <MenuItem icon={Save} onClick={() => { close(); setSaveLabel(''); }}>Save version…</MenuItem>
                  <MenuItem icon={Printer} disabled={!shownId} onClick={() => { close(); print(); }}>Print</MenuItem>
                  <MenuItem icon={full ? Minimize2 : Maximize2} onClick={() => { close(); toggleFull(); }}>{full ? 'Exit fullscreen' : 'Fullscreen'}</MenuItem>
                  <MenuItem icon={BadgeCheck} disabled={!currentId || isOutdated} onClick={() => { close(); finalize(!project.is_final); }}>{project.is_final ? 'Remove final mark' : 'Mark as final'}</MenuItem>
                  <MenuItem icon={Sparkles} disabled={running} onClick={() => { close(); onSend({ content: 'Regenerate the itinerary from the current trip details.', forceGenerate: true }); }}>Regenerate with AI</MenuItem>
                </>
              )}
            </Menu>
          )}
        </div>
      </header>

      {isOutdated && !editorDirty && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[12.5px] text-amber-900">
          <span>The itinerary was edited — the PDF is outdated.</span>
          <button type="button" onClick={() => render({}, 'PDF updated')} disabled={busy === 'render'} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-600 px-2.5 text-[12px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            {busy === 'render' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Update PDF
          </button>
        </div>
      )}
      {shown && shown.id !== currentId && view === 'pdf' && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[12.5px] text-slate-600">
          <span>Viewing version {shown.version_no}.</span>
          <span className="flex gap-1.5">
            <button className="font-semibold text-slate-700 hover:underline" onClick={() => setViewVersionId(null)}>Back to current</button>
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1">{body}</div>

      {view === 'pdf' && shownId && (
        <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5">
          <div className="flex items-center gap-1">
            <button className={iconBtn} disabled={page <= 1} onClick={() => goPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[64px] text-center text-[12px] tabular-nums text-slate-600">Page {page} / {pages}</span>
            <button className={iconBtn} disabled={page >= pages} onClick={() => goPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-1">
            <button className={iconBtn} aria-label="Zoom out" onClick={() => setZoom((z) => { const c = z === 'fit' ? 100 : z; const i = ZOOMS.indexOf(c); return ZOOMS[Math.max(0, (i < 0 ? 2 : i) - 1)]; })}><ZoomOut className="h-4 w-4" /></button>
            <button className="h-7 min-w-[52px] rounded-md px-1.5 text-[12px] font-semibold tabular-nums text-slate-600 hover:bg-slate-100" onClick={() => setZoom('fit')} title="Fit width">{zoom === 'fit' ? 'Fit' : `${zoom}%`}</button>
            <button className={iconBtn} aria-label="Zoom in" onClick={() => setZoom((z) => { const c = z === 'fit' ? 100 : z; const i = ZOOMS.indexOf(c); return ZOOMS[Math.min(ZOOMS.length - 1, (i < 0 ? 2 : i) + 1)]; })}><ZoomIn className="h-4 w-4" /></button>
            <button className={iconBtn} aria-label={full ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFull}>{full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
          </div>
        </footer>
      )}

      {project && (
        <DesignDrawer open={themeOpen} onClose={() => setThemeOpen(false)} project={project} references={state?.references || []} onApply={async (opts) => {
          setBusy('render');
          const ok = await onPatch({ themeOptions: opts }, project.itinerary ? 'Design applied — no AI tokens used' : 'Design saved');
          setBusy(null);
          if (ok) { setThemeOpen(false); setViewVersionId(null); setView('pdf'); }
        }} />
      )}
      {project && (
        <VersionsDrawer
          open={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          projectId={project.id}
          versions={versions}
          currentId={currentId}
          onView={(id) => { setViewVersionId(id); setView('pdf'); setVersionsOpen(false); }}
          onReload={onReload}
        />
      )}
      <ConfirmDialog
        open={saveLabel !== null}
        title="Save version"
        confirmLabel="Save"
        body={
          <>
            <p>{isOutdated ? 'Your edits will be rendered into a new labelled PDF version.' : 'Give the current version a name so it’s easy to find later.'}</p>
            <input autoFocus value={saveLabel || ''} maxLength={80} onChange={(e) => setSaveLabel(e.target.value)} placeholder="e.g. Sent to client" className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
          </>
        }
        onConfirm={() => { const l = saveLabel; setSaveLabel(null); render({ snapshot: true, label: l || 'Saved' }, 'Version saved'); }}
        onClose={() => setSaveLabel(null)}
      />
    </section>
  );
}

