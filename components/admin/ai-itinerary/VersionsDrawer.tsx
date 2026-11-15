'use client';

import { useState } from 'react';
import { ArrowLeftRight, BadgeCheck, Download, Eye, History, Loader2, RotateCcw } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import type { Itinerary, VersionRow } from '@/lib/ai-itinerary/types';
import { MOODS, PALETTES } from '@/lib/ai-itinerary/design';
import { api, downloadPdf, fmtBytes, fmtDate } from './api';
import { ConfirmDialog, Drawer, EmptyState, iconBtn } from './ui';

const SOURCE: Record<string, string> = {
  generate: 'Generated', edit: 'AI edit', theme: 'Design change', manual: 'Manual edits', restore: 'Restored', snapshot: 'Saved', rerender: 'Re-rendered',
};

type Change = { kind: 'added' | 'removed' | 'changed'; label: string };

function diff(a: Itinerary, b: Itinerary): Change[] {
  const out: Change[] = [];
  const keys: [keyof Itinerary, string][] = [
    ['title', 'Title'], ['subtitle', 'Subtitle'], ['destination', 'Destination'], ['durationLabel', 'Duration'], ['dates', 'Dates'],
    ['overview', 'Overview'], ['highlights', 'Highlights'], ['stays', 'Accommodation'], ['transport', 'Transport'], ['inclusions', 'Inclusions'],
    ['exclusions', 'Exclusions'], ['pricing', 'Pricing'], ['pricingNote', 'Pricing note'], ['paymentTerms', 'Payment terms'],
    ['cancellationPolicy', 'Cancellation policy'], ['importantNotes', 'Important notes'], ['thingsToCarry', 'Things to carry'], ['assumptions', 'Assumptions'],
  ];
  for (const [k, l] of keys) if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) out.push({ kind: 'changed', label: l });
  const da = new Map(a.days.map((d) => [d.day, d]));
  const db = new Map(b.days.map((d) => [d.day, d]));
  for (const [n, d] of Array.from(db.entries())) {
    const o = da.get(n);
    if (!o) out.push({ kind: 'added', label: `Day ${n}: ${d.title}` });
    else if (JSON.stringify(o) !== JSON.stringify(d)) out.push({ kind: 'changed', label: `Day ${n}: ${o.title === d.title ? d.title : `${o.title} → ${d.title}`}` });
  }
  for (const [n, d] of Array.from(da.entries())) if (!db.has(n)) out.push({ kind: 'removed', label: `Day ${n}: ${d.title}` });
  return out;
}

export default function VersionsDrawer({
  open, onClose, projectId, versions, currentId, onView, onReload,
}: {
  open: boolean; onClose: () => void; projectId: string; versions: VersionRow[]; currentId: string | null; onView: (id: string) => void; onReload: () => Promise<void>;
}) {
  const { toast } = useAdminLive();
  const [restore, setRestore] = useState<VersionRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ a: VersionRow; b: VersionRow; changes: Change[] | null; themeChanged: boolean } | null>(null);

  const doRestore = async () => {
    if (!restore) return;
    setBusy('restore');
    try {
      await api(`/projects/${projectId}/versions/${restore.id}`, { method: 'POST', json: { action: 'restore' } });
      toast(`Restored version ${restore.version_no}`);
      setRestore(null);
      await onReload();
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(null); }
  };

  const doCompare = async (v: VersionRow) => {
    const cur = versions.find((x) => x.id === currentId);
    if (!cur || cur.id === v.id) return;
    const [older, newer] = v.version_no < cur.version_no ? [v, cur] : [cur, v];
    setCompare({ a: older, b: newer, changes: null, themeChanged: older.theme !== newer.theme || JSON.stringify(older.theme_options) !== JSON.stringify(newer.theme_options) });
    try {
      const [ra, rb] = await Promise.all([
        api<{ version: VersionRow }>(`/projects/${projectId}/versions/${older.id}`),
        api<{ version: VersionRow }>(`/projects/${projectId}/versions/${newer.id}`),
      ]);
      setCompare((c) => (c ? { ...c, changes: diff(ra.version.itinerary!, rb.version.itinerary!) } : c));
    } catch (e) { toast((e as Error).message, 'error'); setCompare(null); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Version history" subtitle="Every render is kept. Restoring never deletes newer versions." width="sm:max-w-md">
      {!versions.length && <EmptyState icon={History} title="No versions yet" />}
      <ol className="space-y-1.5">
        {versions.map((v) => {
          const current = v.id === currentId;
          return (
            <li key={v.id} className={`rounded-xl border px-3 py-2.5 ${current ? 'border-purple-200 bg-purple-50/50' : 'border-slate-200'}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-slate-900">
                    v{v.version_no}
                    <span className="font-normal text-slate-500">· {v.label || SOURCE[v.source] || v.source}</span>
                    {current && <span className="rounded bg-purple-600 px-1.5 text-[10px] font-bold text-white">CURRENT</span>}
                    {v.is_final && <span className="inline-flex items-center gap-0.5 rounded bg-slate-900 px-1.5 text-[10px] font-bold text-white"><BadgeCheck className="h-3 w-3" />FINAL</span>}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">
                    {fmtDate(v.created_at, true)} · {MOODS.find((m) => m.key === v.theme_options?.design?.mood)?.label || 'Auto design'}{v.theme_options?.design?.palette ? ` · ${PALETTES.find((p) => p.key === v.theme_options?.design?.palette)?.name || 'photo colours'}` : ''} · {v.page_count || '?'} pages · {fmtBytes(v.pdf_size)}{v.model ? ` · ${v.model}` : ''}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  <button type="button" className={iconBtn} title="View" onClick={() => onView(v.id)}><Eye className="h-4 w-4" /></button>
                  <button type="button" className={iconBtn} title="Download" onClick={() => downloadPdf(v.id).catch((e) => toast('Download failed', 'error', { sub: e.message }))}><Download className="h-4 w-4" /></button>
                  {!current && <button type="button" className={iconBtn} title="Compare with current" onClick={() => doCompare(v)}><ArrowLeftRight className="h-4 w-4" /></button>}
                  {!current && <button type="button" className={iconBtn} title="Restore" onClick={() => setRestore(v)}><RotateCcw className="h-4 w-4" /></button>}
                </div>
              </div>
              {compare && (compare.a.id === v.id || compare.b.id === v.id) && !current && (
                <div className="mt-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                  <p className="text-[12px] font-semibold text-slate-700">v{compare.a.version_no} → v{compare.b.version_no}</p>
                  {compare.changes === null ? <p className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />Comparing…</p> : (
                    <ul className="mt-1 space-y-0.5 text-[12px]">
                      {compare.themeChanged && <li className="text-slate-600">~ Theme / layout</li>}
                      {!compare.changes.length && !compare.themeChanged && <li className="text-slate-500">No content differences.</li>}
                      {compare.changes.map((c, i) => (
                        <li key={i} className={c.kind === 'added' ? 'text-emerald-700' : c.kind === 'removed' ? 'text-red-600' : 'text-slate-700'}>
                          {c.kind === 'added' ? '+ ' : c.kind === 'removed' ? '− ' : '~ '}{c.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <ConfirmDialog
        open={!!restore}
        title={`Restore version ${restore?.version_no}?`}
        body="Its content and theme become current. Unsaved edits are discarded; newer versions stay in history."
        confirmLabel="Restore"
        busy={busy === 'restore'}
        onConfirm={doRestore}
        onClose={() => setRestore(null)}
      />
    </Drawer>
  );
}
