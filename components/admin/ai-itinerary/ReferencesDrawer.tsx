'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, FileText, ImagePlus, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { IMAGE_ROLES, REFERENCE_PURPOSES, type ImageRole, type ReferencePurpose, type ReferenceRow } from '@/lib/ai-itinerary/types';
import { BASE, api, fmtBytes, fmtDate } from './api';
import { ConfirmDialog, Drawer, EmptyState, iconBtn, smallSecondary } from './ui';

const sel = 'h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12.5px] outline-none focus:border-purple-400';

/** Photos + reference files: placement, purpose, preview, replace, remove. */
export default function ReferencesDrawer({
  open, onClose, projectId, references, dayCount, hasPdf, onReload, onUpload,
}: {
  open: boolean; onClose: () => void; projectId: string; references: ReferenceRow[]; dayCount: number; hasPdf?: boolean;
  onReload: () => Promise<void>; onUpload: (files: File[], purpose?: ReferencePurpose) => Promise<void>;
}) {
  const { toast } = useAdminLive();
  const [preview, setPreview] = useState<{ ref: ReferenceRow; text: string | null } | null>(null);
  const [removing, setRemoving] = useState<ReferenceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState<ReferenceRow | null>(null);
  const [photosChanged, setPhotosChanged] = useState(false);
  const [rendering, setRendering] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const photos = references.filter((r) => r.kind === 'image');
  const docs = references.filter((r) => r.kind !== 'image');

  const patch = async (r: ReferenceRow, body: Record<string, unknown>) => {
    try {
      await api(`/projects/${projectId}/references/${r.id}`, { method: 'PATCH', json: body });
      if (r.kind === 'image') setPhotosChanged(true);
      await onReload();
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const showPreview = async (r: ReferenceRow) => {
    setPreview({ ref: r, text: null });
    try {
      const j = await api<{ reference: ReferenceRow & { preview: string } }>(`/projects/${projectId}/references/${r.id}`);
      setPreview({ ref: r, text: j.reference.preview || '(no text extracted)' });
    } catch (e) { setPreview({ ref: r, text: `Couldn’t load preview: ${(e as Error).message}` }); }
  };

  const remove = async (r: ReferenceRow, silent = false) => {
    setBusy(true);
    try {
      await api(`/projects/${projectId}/references/${r.id}`, { method: 'DELETE' });
      if (!silent) toast(r.kind === 'image' ? 'Photo removed' : 'Reference removed');
      if (r.kind === 'image') setPhotosChanged(true);
      await onReload();
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); setRemoving(null); }
  };

  const onFiles = async (files: File[]) => {
    if (replacing && files[0]) {
      const old = replacing;
      setReplacing(null);
      await onUpload([files[0]], old.purpose === 'photo' ? 'auto' : old.purpose);
      await remove(old, true);
      toast('Replaced');
    } else {
      await onUpload(files);
    }
    if (files.some((f) => f.type.startsWith('image/'))) setPhotosChanged(true);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Photos & reference files"
      subtitle="Photos are placed in the PDF. File text is used as data only — never as instructions."
      width="sm:max-w-xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {photosChanged && hasPdf && (
            <button
              type="button"
              disabled={rendering}
              onClick={async () => {
                setRendering(true);
                try { await api(`/projects/${projectId}/render`, { method: 'POST', json: {} }); toast('PDF updated with your photos'); setPhotosChanged(false); await onReload(); }
                catch (e) { toast((e as Error).message, 'error'); }
                finally { setRendering(false); }
              }}
              className="mr-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-purple-600 px-3 text-[13px] font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Update PDF
            </button>
          )}
          <button type="button" className={smallSecondary} onClick={() => { setReplacing(null); photoRef.current?.click(); }}><ImagePlus className="h-3.5 w-3.5" /> Add photos</button>
          <button type="button" className={smallSecondary} onClick={() => { setReplacing(null); fileRef.current?.click(); }}><Upload className="h-3.5 w-3.5" /> Add PDF / notes</button>
        </div>
      }
    >
      <input ref={fileRef} type="file" multiple={!replacing} accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" className="hidden" onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
      <input ref={photoRef} type="file" multiple={!replacing} accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />

      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Photos for the PDF · {photos.length}</h4>
        {!photos.length ? (
          <button type="button" onClick={() => photoRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-left hover:border-purple-300 hover:bg-purple-50/30">
            <ImagePlus className="h-5 w-5 text-purple-600" />
            <span><span className="block text-[13px] font-semibold text-slate-800">Add your trip photos</span><span className="block text-[12px] text-slate-500">They become the cover, day-page photos and a gallery. Without photos, a photo from your published trips may be used for the cover.</span></span>
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5">
            {photos.map((r) => (
              <li key={r.id} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="relative aspect-[4/3] bg-slate-100">
                  {r.status === 'ready'
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`${BASE}/projects/${projectId}/references/${r.id}?file=1`} alt={r.caption || r.filename} loading="lazy" className={`h-full w-full object-cover ${r.image_role === 'exclude' ? 'opacity-40 grayscale' : ''}`} />
                    : <div className="flex h-full items-center justify-center text-[12px] text-red-600"><AlertTriangle className="mr-1 h-4 w-4" />{r.error || 'Failed'}</div>}
                  <div className="absolute right-1.5 top-1.5 flex gap-1">
                    <button type="button" className="rounded-md bg-white/90 p-1 text-slate-600 shadow-sm hover:text-slate-900" title="Replace" onClick={() => { setReplacing(r); setTimeout(() => photoRef.current?.click(), 0); }}><RefreshCw className="h-3.5 w-3.5" /></button>
                    <button type="button" className="rounded-md bg-white/90 p-1 text-slate-600 shadow-sm hover:text-red-600" title="Remove" onClick={() => setRemoving(r)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {r.meta?.palette && <span className="absolute bottom-1.5 left-1.5 h-4 w-4 rounded-full ring-2 ring-white" style={{ background: r.meta.palette.primary }} title="Dominant colour — can drive the PDF colours (Design → From your photo)" />}
                </div>
                <div className="space-y-1.5 p-2">
                  <div className="flex gap-1.5">
                    <select aria-label="Use photo as" className={`${sel} min-w-0 flex-1`} value={r.image_role || 'auto'} onChange={(e) => patch(r, { image_role: e.target.value as ImageRole, ...(e.target.value === 'day' && !r.image_day ? { image_day: 1 } : {}) })}>
                      {IMAGE_ROLES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                    </select>
                    {r.image_role === 'day' && (
                      <select aria-label="Day" className={`${sel} w-[72px]`} value={r.image_day || 1} onChange={(e) => patch(r, { image_day: Number(e.target.value) })}>
                        {Array.from({ length: Math.max(dayCount, r.image_day || 1, 1) }).map((_, i) => <option key={i} value={i + 1}>Day {i + 1}</option>)}
                      </select>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-slate-400" title={r.filename}>{r.filename} · {fmtBytes(r.size_bytes)}{r.error && r.status === 'ready' ? ` · ${r.error}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Reference files · {docs.length}</h4>
        {!docs.length && <EmptyState icon={FileText} title="No reference files" body="Attach an old itinerary, another agency’s PDF or design inspiration — choose what it’s for." />}
        <ul className="space-y-2">
          {docs.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{r.filename}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-slate-500">
                    <span>{fmtBytes(r.size_bytes)}</span>
                    {r.page_count ? <span>{r.page_count} page{r.page_count === 1 ? '' : 's'}</span> : null}
                    <span>{fmtDate(r.created_at, true)}</span>
                    {r.status === 'ready' && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" />Ready</span>}
                    {r.status === 'processing' && <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />Processing</span>}
                    {r.status === 'failed' && <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" />Failed</span>}
                    {r.meta?.palette && <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: r.meta.palette.primary }} />colours found</span>}
                  </p>
                  {r.error && <p className={`mt-1 text-[11.5px] leading-snug ${r.status === 'failed' ? 'text-red-600' : 'text-amber-700'}`}>{r.error}</p>}
                  <select value={r.purpose} onChange={(e) => patch(r, { purpose: e.target.value as ReferencePurpose })} aria-label="Purpose" className={`${sel} mt-2 w-full`}>
                    {REFERENCE_PURPOSES.filter((p) => p.key !== 'photo').map((p) => <option key={p.key} value={p.key}>{p.label} — {p.hint}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button type="button" className={iconBtn} title="Preview extracted text" onClick={() => showPreview(r)}><Eye className="h-4 w-4" /></button>
                  <a className={iconBtn} title="Open original" href={`${BASE}/projects/${projectId}/references/${r.id}?file=1`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  <button type="button" className={iconBtn} title="Replace" onClick={() => { setReplacing(r); setTimeout(() => fileRef.current?.click(), 0); }}><RefreshCw className="h-4 w-4" /></button>
                  <button type="button" className={`${iconBtn} hover:bg-red-50 hover:text-red-600`} title="Remove" onClick={() => setRemoving(r)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {preview && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold text-slate-700">Extracted text · {preview.ref.filename}</p>
            <button type="button" onClick={() => setPreview(null)} className="text-[12px] font-semibold text-slate-500 hover:text-slate-900">Close</button>
          </div>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-slate-700">{preview.text ?? 'Loading…'}</pre>
        </div>
      )}
      <ConfirmDialog
        open={!!removing}
        danger
        busy={busy}
        title={removing?.kind === 'image' ? 'Remove photo?' : 'Remove reference file?'}
        body={<>“{removing?.filename}” will be deleted from storage.{removing?.kind === 'image' ? ' It disappears from the PDF on the next render.' : ' Details already captured from it stay in Trip Details.'}</>}
        confirmLabel="Remove"
        onConfirm={() => removing && remove(removing)}
        onClose={() => setRemoving(null)}
      />
    </Drawer>
  );
}
