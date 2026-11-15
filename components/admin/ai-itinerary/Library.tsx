'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive, ArchiveRestore, Copy, Dices, Download, Eye, FileText, LayoutGrid, List, MessageSquare, MoreHorizontal, Palette, Pencil, RefreshCw, Search, Trash2, X,
} from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { MOODS, newSeed, resolveDesign } from '@/lib/ai-itinerary/design';
import { api, downloadPdf, fmtBytes, fmtDate, LS, pdfUrl, type ProjectListItem } from './api';
import { useStudio } from './StudioApp';
import { ConfirmDialog, EmptyState, Menu, MenuItem, StatusBadge, iconBtn } from './ui';
import { DesignSwatch } from './DesignDrawer';
import { ListSkeleton } from './Skeletons';
import PdfViewer from './PdfViewer';

type Mode = 'grid' | 'list';

export default function Library() {
  const { openProject, settings } = useStudio();
  const { toast } = useAdminLive();
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [theme, setTheme] = useState('');
  const [range, setRange] = useState('all');
  const [archived, setArchived] = useState(false);
  const [mode, setMode] = useState<Mode>('grid');
  const [preview, setPreview] = useState<ProjectListItem | null>(null);
  const [del, setDel] = useState<ProjectListItem | null>(null);
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { setMode((LS.get('gk_ais_lib_mode') as Mode) || 'grid'); }, []);
  const setModeP = (m: Mode) => { setMode(m); LS.set('gk_ais_lib_mode', m); };

  const load = useCallback(async () => {
    try {
      const r = await api<{ projects: ProjectListItem[] }>(`/projects?archived=${archived ? '1' : '0'}`);
      setItems(r.projects);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }, [archived]);
  useEffect(() => { setItems(null); load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const since = range === 'all' ? 0 : Date.now() - Number(range) * 86400_000;
    return (items || []).filter((p) => {
      if (s && !`${p.title} ${p.destination || ''}`.toLowerCase().includes(s)) return false;
      if (theme && (p.theme_options?.design?.mood || 'auto') !== theme) return false;
      if (since && new Date(p.updated_at).getTime() < since) return false;
      if (status === 'pdf' && !p.current_version_id) return false;
      if (status === 'final' && !p.is_final) return false;
      if (status === 'outdated' && !p.itinerary_dirty) return false;
      if (status === 'draft' && p.current_version_id) return false;
      if (status === 'failed' && p.status !== 'failed') return false;
      return true;
    });
  }, [items, q, theme, range, status]);

  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) toast(ok); await load(); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(null); }
  };

  // eslint-disable-next-line react/display-name -- render-prop factory, not a component
  const actions = (p: ProjectListItem) => (close: () => void) => (
    <>
      <MenuItem icon={MessageSquare} onClick={() => { close(); openProject(p.id); }}>Continue conversation</MenuItem>
      <MenuItem icon={Eye} disabled={!p.current_version_id} onClick={() => { close(); setPreview(p); }}>Preview</MenuItem>
      <MenuItem icon={Download} disabled={!p.current_version_id} onClick={() => { close(); downloadPdf(p.current_version_id!).catch((e) => toast('Download failed', 'error', { sub: e.message })); }}>Download PDF</MenuItem>
      <MenuItem icon={RefreshCw} disabled={!p.current_version_id} onClick={() => { close(); act(p.id, () => api(`/projects/${p.id}/render`, { method: 'POST', json: {} }), 'PDF re-rendered'); }}>Regenerate PDF</MenuItem>
      <MenuItem icon={Pencil} onClick={() => { close(); setRename({ id: p.id, title: p.title }); }}>Rename</MenuItem>
      <MenuItem icon={Copy} onClick={() => { close(); act(p.id, () => api(`/projects/${p.id}/duplicate`, { method: 'POST' }), 'Duplicated'); }}>Duplicate</MenuItem>
      {p.archived_at
        ? <MenuItem icon={ArchiveRestore} onClick={() => { close(); act(p.id, () => api(`/projects/${p.id}`, { method: 'PATCH', json: { archived: false } }), 'Unarchived'); }}>Unarchive</MenuItem>
        : <MenuItem icon={Archive} onClick={() => { close(); act(p.id, () => api(`/projects/${p.id}`, { method: 'PATCH', json: { archived: true } }), 'Archived'); }}>Archive</MenuItem>}
      <MenuItem icon={Trash2} danger onClick={() => { close(); setDel(p); }}>Delete</MenuItem>
    </>
  );

  const redesign = (p: ProjectListItem, patch: Record<string, unknown>, msg: string) => {
    const prev = p.theme_options?.design || {};
    return act(p.id, () => api(`/projects/${p.id}`, { method: 'PATCH', json: { themeOptions: { ...(p.theme_options || {}), design: { ...prev, ...patch } } } }), msg);
  };
  const themeMenu = (p: ProjectListItem) => (
    <Menu width="w-56" trigger={({ toggle }) => <button type="button" className={iconBtn} title="Re-design (no AI tokens)" onClick={toggle} disabled={busy === p.id || !p.current_version_id}><Palette className="h-4 w-4" /></button>}>
      {(close) => (
        <>
          <MenuItem icon={Dices} onClick={() => { close(); redesign(p, { seed: newSeed(), cover: undefined, motif: undefined, dayStyle: undefined }, 'New design rendered'); }}>Shuffle design</MenuItem>
          <p className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Re-design in a mood</p>
          {MOODS.map((m) => (
            <MenuItem key={m.key} hint={p.theme_options?.design?.mood === m.key ? 'current' : undefined} onClick={() => { close(); redesign(p, { mood: m.key, fonts: undefined, palette: undefined, cover: undefined, seed: newSeed() }, `Re-designed: ${m.label}`); }}>{m.label}</MenuItem>
          ))}
        </>
      )}
    </Menu>
  );
  const specOf = (p: ProjectListItem) => resolveDesign(p.theme_options?.design, { photoCount: 0, dayCount: 3, legacyTheme: p.id });
  const moodName = (p: ProjectListItem) => MOODS.find((m) => m.key === p.theme_options?.design?.mood)?.label || 'Auto design';

  const sel = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none focus:border-purple-400';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2.5">
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by trip or destination" className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-[13px] outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel} aria-label="Status">
          <option value="all">All statuses</option><option value="pdf">Has PDF</option><option value="final">Final</option><option value="outdated">PDF outdated</option><option value="draft">Drafts (no PDF)</option><option value="failed">Failed</option>
        </select>
        <select value={theme} onChange={(e) => setTheme(e.target.value)} className={sel} aria-label="Theme">
          <option value="">All designs</option><option value="auto">Auto design</option>{MOODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value)} className={sel} aria-label="Date">
          <option value="all">Any date</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
        </select>
        <button type="button" onClick={() => setArchived((a) => !a)} className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${archived ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Archived</button>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          <button type="button" aria-label="Grid view" onClick={() => setModeP('grid')} className={`rounded-md p-1.5 ${mode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}><LayoutGrid className="h-4 w-4" /></button>
          <button type="button" aria-label="List view" onClick={() => setModeP('list')} className={`rounded-md p-1.5 ${mode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}><List className="h-4 w-4" /></button>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} <button className="font-semibold underline" onClick={load}>Retry</button></p>}
      {items === null && !error && <ListSkeleton />}
      {items && !filtered.length && (
        <div className="rounded-2xl border border-slate-200/80 bg-white">
          <EmptyState icon={FileText} title={items.length ? 'Nothing matches these filters' : archived ? 'No archived itineraries' : 'Your library is empty'} body={items.length ? 'Clear a filter to see more.' : 'Generated itineraries and drafts appear here.'} action={!items.length && !archived ? <button className="text-sm font-semibold text-purple-700 hover:underline" onClick={() => openProject(null)}>Open the Studio</button> : undefined} />
        </div>
      )}

      {mode === 'grid' ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((p) => (
            <li key={p.id} className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-3 transition hover:border-slate-300 hover:shadow-[0_4px_16px_-6px_rgba(15,23,42,0.12)]">
              <div className="flex gap-3">
                <button type="button" className="w-16 flex-shrink-0" onClick={() => (p.current_version_id ? setPreview(p) : openProject(p.id))} aria-label={`Open ${p.title}`}>
                  <DesignSwatch spec={specOf(p)} />
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => openProject(p.id)} className="block w-full truncate text-left text-[14px] font-bold text-slate-900 hover:text-purple-700">{p.title}</button>
                  <p className="truncate text-[12.5px] text-slate-500">{[p.destination, p.duration_label].filter(Boolean).join(' · ') || 'No destination yet'}</p>
                  <div className="mt-1.5"><StatusBadge status={p.status} final={p.is_final} dirty={p.itinerary_dirty && !!p.current_version_id} small /></div>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-[11.5px]">
                <div><dt className="text-slate-400">Updated</dt><dd className="font-medium text-slate-700">{fmtDate(p.updated_at)}</dd></div>
                <div><dt className="text-slate-400">Versions</dt><dd className="font-medium text-slate-700">{p.version_count}{p.page_count ? ` · ${p.page_count}p` : ''}</dd></div>
                <div><dt className="text-slate-400">Size</dt><dd className="font-medium text-slate-700">{fmtBytes(p.pdf_size)}</dd></div>
                <div className="col-span-2"><dt className="text-slate-400">Design · model</dt><dd className="truncate font-medium text-slate-700">{moodName(p)}{p.model ? ` · ${settings?.settings.pricing.models.find((m) => m.key === p.model)?.displayName || p.model}` : ''}</dd></div>
                <div><dt className="text-slate-400">Created</dt><dd className="font-medium text-slate-700">{fmtDate(p.created_at)}</dd></div>
              </dl>
              <div className="mt-2.5 flex items-center gap-1">
                <button type="button" className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openProject(p.id)}><MessageSquare className="h-3.5 w-3.5" /> Open</button>
                <button type="button" className={iconBtn} title="Download" disabled={!p.current_version_id} onClick={() => downloadPdf(p.current_version_id!).catch((e) => toast('Download failed', 'error', { sub: e.message }))}><Download className="h-4 w-4" /></button>
                {themeMenu(p)}
                <Menu width="w-52" trigger={({ toggle }) => <button type="button" className={iconBtn} aria-label="More actions" onClick={toggle}><MoreHorizontal className="h-4 w-4" /></button>}>{actions(p)}</Menu>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        filtered.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-2.5 font-semibold">Trip</th><th className="px-3 font-semibold">Status</th><th className="px-3 font-semibold">Design</th><th className="px-3 font-semibold">Versions</th><th className="px-3 font-semibold">Size</th><th className="px-3 font-semibold">Created</th><th className="px-3 font-semibold">Updated</th><th className="px-3" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="max-w-[280px] px-4 py-2.5">
                      <button type="button" className="block max-w-full truncate font-semibold text-slate-900 hover:text-purple-700" onClick={() => openProject(p.id)}>{p.title}</button>
                      <span className="block truncate text-[12px] text-slate-500">{[p.destination, p.duration_label].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td className="px-3"><StatusBadge status={p.status} final={p.is_final} dirty={p.itinerary_dirty && !!p.current_version_id} small /></td>
                    <td className="px-3 text-slate-600">{moodName(p)}</td>
                    <td className="px-3 tabular-nums text-slate-600">{p.version_count}</td>
                    <td className="px-3 tabular-nums text-slate-600">{fmtBytes(p.pdf_size)}</td>
                    <td className="px-3 text-slate-600">{fmtDate(p.created_at)}</td>
                    <td className="px-3 text-slate-600">{fmtDate(p.updated_at)}</td>
                    <td className="px-3">
                      <div className="flex justify-end gap-0.5">
                        <button type="button" className={iconBtn} title="Download" disabled={!p.current_version_id} onClick={() => downloadPdf(p.current_version_id!).catch((e) => toast('Download failed', 'error', { sub: e.message }))}><Download className="h-4 w-4" /></button>
                        {themeMenu(p)}
                        <Menu width="w-52" trigger={({ toggle }) => <button type="button" className={iconBtn} aria-label="More actions" onClick={toggle}><MoreHorizontal className="h-4 w-4" /></button>}>{actions(p)}</Menu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {preview?.current_version_id && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 p-2 sm:p-6" onMouseDown={() => setPreview(null)}>
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Preview ${preview.title}`}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{preview.title}</p>
              <button type="button" className={iconBtn} title="Download" onClick={() => downloadPdf(preview.current_version_id!).catch((e) => toast('Download failed', 'error', { sub: e.message }))}><Download className="h-4 w-4" /></button>
              <button type="button" className={iconBtn} aria-label="Close preview" onClick={() => setPreview(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1"><PdfViewer url={pdfUrl(preview.current_version_id)} zoom="fit" /></div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!del}
        danger
        busy={busy === del?.id}
        title="Delete this itinerary?"
        body={<>“{del?.title}”, its conversation, {del?.version_count || 0} PDF version(s) and reference files will be permanently deleted. This can’t be undone.</>}
        confirmLabel="Delete permanently"
        onConfirm={() => del && act(del.id, () => api(`/projects/${del.id}`, { method: 'DELETE' }), 'Deleted').then(() => setDel(null))}
        onClose={() => setDel(null)}
      />
      {rename && (
        <ConfirmDialog
          open
          title="Rename itinerary"
          confirmLabel="Save"
          body={<input autoFocus value={rename.title} maxLength={140} onChange={(e) => setRename({ ...rename, title: e.target.value })} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />}
          onConfirm={() => { const r = rename; setRename(null); if (r.title.trim()) act(r.id, () => api(`/projects/${r.id}`, { method: 'PATCH', json: { title: r.title } }), 'Renamed'); }}
          onClose={() => setRename(null)}
        />
      )}
    </div>
  );
}
