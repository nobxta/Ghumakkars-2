'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArchiveRestore, Copy, FileText, MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen, Pencil, Plus, Search, Trash2,
} from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { api, ApiError, LS, uid, type ProjectListItem, type StudioState } from './api';
import { useStudio } from './StudioApp';
import { ConfirmDialog, EmptyState, Menu, MenuItem, StatusBadge, iconBtn } from './ui';
import { STUDIO_H } from './Skeletons';
import ChatPanel, { type PendingSend } from './ChatPanel';
import PreviewPanel from './PreviewPanel';
import { timeAgo } from '@/components/admin/settings/ui';

type Pane = 'sessions' | 'chat' | 'preview';
type Filter = 'all' | 'drafts' | 'ready' | 'archived';

export default function Studio() {
  const { projectId, openProject } = useStudio();
  const { toast } = useAdminLive();
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [state, setState] = useState<StudioState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSend | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [pane, setPane] = useState<Pane>('chat');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const loadSeq = useRef(0);

  useEffect(() => {
    setLeftOpen(LS.get('gk_ais_left') !== '0');
    setRightOpen(LS.get('gk_ais_right') !== '0');
  }, []);
  const toggleLeft = () => setLeftOpen((v) => { LS.set('gk_ais_left', v ? '0' : '1'); return !v; });
  const toggleRight = () => setRightOpen((v) => { LS.set('gk_ais_right', v ? '0' : '1'); return !v; });

  /* ── data ── */
  const loadList = useCallback(async () => {
    try {
      const archived = filter === 'archived' ? '1' : '0';
      const r = await api<{ projects: ProjectListItem[] }>(`/projects?archived=${archived}`);
      setProjects(r.projects);
      setListError(null);
    } catch (e) {
      setListError((e as Error).message);
    }
  }, [filter]);
  useEffect(() => { loadList(); }, [loadList]);

  const loadProject = useCallback(async (id: string) => {
    const seq = ++loadSeq.current;
    try {
      const r = await api<StudioState>(`/projects/${id}`);
      if (seq !== loadSeq.current) return null;
      setState(r);
      setLoadError(null);
      setProjects((list) => list?.map((p) => (p.id === id ? { ...p, title: r.project.title, status: r.project.status, destination: r.project.destination, updated_at: r.project.updated_at, current_version_id: r.project.current_version_id, is_final: r.project.is_final, itinerary_dirty: r.project.itinerary_dirty } : p)) || list);
      return r;
    } catch (e) {
      if (seq !== loadSeq.current) return null;
      if (e instanceof ApiError && e.status === 404) { setState(null); openProject(null); toast('That itinerary no longer exists', 'error'); }
      else setLoadError((e as Error).message);
      return null;
    }
  }, [openProject, toast]);

  useEffect(() => {
    setState(null);
    setPending(null);
    setLoadError(null);
    if (projectId) loadProject(projectId);
  }, [projectId, loadProject]);

  // Poll while a job is running (also covers a refresh during generation).
  const running = !!state?.job || state?.project.status === 'generating' || !!pending;
  useEffect(() => {
    if (!running || !projectId) return;
    const t = setInterval(() => loadProject(projectId), 2000);
    return () => clearInterval(t);
  }, [running, projectId, loadProject]);

  /* ── actions ── */
  const createProject = useCallback(async () => {
    try {
      const r = await api<{ project: ProjectListItem }>('/projects', { method: 'POST', json: { model: LS.get('gk_ais_model') || undefined } });
      setProjects((l) => [r.project, ...(l || [])]);
      openProject(r.project.id);
      setPane('chat');
      return r.project.id;
    } catch (e) {
      toast((e as Error).message, 'error');
      return null;
    }
  }, [openProject, toast]);

  // Alt+N → new itinerary ("n" alone is the admin-wide Quick add).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'n' || e.key === 'N' || e.code === 'KeyN')) { e.preventDefault(); createProject(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createProject]);

  const send = useCallback(async (opts: { content: string; forceGenerate?: boolean; referenceIds?: string[]; model?: string; priority?: boolean }) => {
    if (pending) return false;
    let id = projectId;
    if (!id) id = await createProject();
    if (!id) return false;
    const clientId = uid();
    setPending({ clientId, content: opts.content || 'Generate with available details.', forceGenerate: !!opts.forceGenerate, startedAt: Date.now() });
    try {
      const r = await api<{ ok?: boolean; error?: string; duplicate?: boolean }>(`/projects/${id}/messages`, {
        method: 'POST',
        json: { content: opts.content, clientId, forceGenerate: opts.forceGenerate, referenceIds: opts.referenceIds, model: opts.model, priority: opts.priority },
      });
      if (r.ok === false && r.error) toast('The AI request failed', 'error', { sub: r.error });
      return true;
    } catch (e) {
      // Network drop: the server may still be working — polling will pick it up.
      if (e instanceof ApiError && e.status === 0) toast('Connection lost — checking whether the request finished…', 'info');
      else toast((e as Error).message, 'error');
      return e instanceof ApiError && e.status === 0;
    } finally {
      setPending(null);
      await loadProject(id);
      loadList();
    }
  }, [pending, projectId, createProject, toast, loadProject, loadList]);

  const patchProject = useCallback(async (id: string, body: Record<string, unknown>, okMsg?: string) => {
    try {
      await api(`/projects/${id}`, { method: 'PATCH', json: body });
      if (okMsg) toast(okMsg);
      if (id === projectId) await loadProject(id);
      loadList();
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      return false;
    }
  }, [projectId, loadProject, loadList, toast]);

  const duplicate = async (p: ProjectListItem) => {
    try {
      const r = await api<{ id: string }>(`/projects/${p.id}/duplicate`, { method: 'POST' });
      toast('Duplicated');
      await loadList();
      openProject(r.id);
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api(`/projects/${confirmDelete.id}`, { method: 'DELETE' });
      toast('Itinerary deleted');
      if (confirmDelete.id === projectId) openProject(null);
      setConfirmDelete(null);
      loadList();
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects || []).filter((p) => {
      if (filter === 'drafts' && p.current_version_id) return false;
      if (filter === 'ready' && !p.current_version_id) return false;
      if (!q) return true;
      return `${p.title} ${p.destination || ''}`.toLowerCase().includes(q);
    });
  }, [projects, query, filter]);

  const project = state?.project || null;

  /* ── panels ── */
  const sessions = (
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white">
      <div className="flex items-center gap-2 p-3 pb-2">
        <button type="button" onClick={createProject} title="New itinerary (Alt+N)" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-purple-600 text-[13px] font-semibold text-white shadow-sm transition hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300">
          <Plus className="h-4 w-4" /> New itinerary
        </button>
        <button type="button" onClick={toggleLeft} className={`${iconBtn} hidden lg:inline-flex`} aria-label="Collapse sessions panel"><PanelLeftClose className="h-4 w-4" /></button>
      </div>
      <div className="px-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search itineraries" className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-8 pr-2 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100" />
        </label>
        <div className="mt-2 flex gap-1 text-[11.5px] font-semibold">
          {(['all', 'drafts', 'ready', 'archived'] as Filter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-md px-2 py-1 capitalize transition ${filter === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{f === 'ready' ? 'PDFs' : f}</button>
          ))}
        </div>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {projects === null && !listError && <div className="space-y-1.5 p-1">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="sk sk-soft h-12 rounded-lg" />)}</div>}
        {listError && <p className="p-3 text-xs text-red-600">{listError} <button className="font-semibold underline" onClick={loadList}>Retry</button></p>}
        {projects && !filtered.length && (
          <EmptyState icon={MessageSquare} title={query ? 'No matches' : filter === 'archived' ? 'Nothing archived' : 'No itineraries yet'} body={query ? 'Try another search.' : 'Start a conversation and the studio will build the itinerary with you.'} />
        )}
        <ul className="space-y-0.5">
          {filtered.map((p) => {
            const active = p.id === projectId;
            return (
              <li key={p.id}>
                <div className={`group relative flex items-start gap-2 rounded-lg px-2.5 py-2 transition ${active ? 'bg-purple-50/80' : 'hover:bg-slate-50'}`}>
                  <button type="button" onClick={() => { openProject(p.id); setPane('chat'); }} className="min-w-0 flex-1 text-left focus-visible:outline-none" aria-current={active ? 'true' : undefined}>
                    <span className={`block truncate text-[13px] font-semibold ${active ? 'text-purple-900' : 'text-slate-800'}`}>{p.title}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <StatusBadge status={p.status} final={p.is_final} dirty={p.itinerary_dirty && !!p.current_version_id} small />
                      <span className="truncate text-[11px] text-slate-400">{timeAgo(p.updated_at)}</span>
                    </span>
                  </button>
                  <Menu
                    width="w-44"
                    trigger={({ toggle, open }) => (
                      <button type="button" onClick={toggle} aria-label={`Actions for ${p.title}`} className={`${iconBtn} h-7 w-7 ${open ? 'bg-slate-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'} [@media(hover:none)]:opacity-100`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  >
                    {(close) => (
                      <>
                        <MenuItem icon={Pencil} onClick={() => { close(); setRenaming({ id: p.id, title: p.title }); }}>Rename</MenuItem>
                        <MenuItem icon={Copy} onClick={() => { close(); duplicate(p); }}>Duplicate</MenuItem>
                        {p.archived_at
                          ? <MenuItem icon={ArchiveRestore} onClick={() => { close(); patchProject(p.id, { archived: false }, 'Restored from archive'); }}>Unarchive</MenuItem>
                          : <MenuItem icon={Archive} onClick={() => { close(); patchProject(p.id, { archived: true }, 'Archived'); }}>Archive</MenuItem>}
                        <MenuItem icon={Trash2} danger onClick={() => { close(); setConfirmDelete(p); }}>Delete</MenuItem>
                      </>
                    )}
                  </Menu>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );

  const chat = (
    <ChatPanel
      state={state}
      loading={!!projectId && !state && !loadError}
      loadError={loadError}
      onRetryLoad={() => projectId && loadProject(projectId)}
      pending={pending}
      onSend={send}
      onPatch={(body, msg) => (project ? patchProject(project.id, body, msg) : Promise.resolve(false))}
      onReload={() => (projectId ? loadProject(projectId).then(() => undefined) : Promise.resolve())}
      leftToggle={!leftOpen ? <button type="button" onClick={toggleLeft} className={`${iconBtn} hidden lg:inline-flex`} aria-label="Show sessions panel"><PanelLeftOpen className="h-4 w-4" /></button> : null}
      rightToggle={<button type="button" onClick={toggleRight} className={`${iconBtn} hidden lg:inline-flex`} aria-label={rightOpen ? 'Hide preview panel' : 'Show preview panel'}>{rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}</button>}
      onShowPreview={() => setPane('preview')}
    />
  );

  const preview = (
    <PreviewPanel
      state={state}
      running={running}
      onReload={() => (projectId ? loadProject(projectId).then(() => undefined) : Promise.resolve())}
      onPatch={(body, msg) => (project ? patchProject(project.id, body, msg) : Promise.resolve(false))}
      onSend={send}
    />
  );

  const cols = `${leftOpen ? '260px ' : ''}minmax(0,1fr)${rightOpen ? ' minmax(0,1.08fr)' : ''}`;

  return (
    <>
      {/* Mobile / tablet: one pane at a time */}
      <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 lg:hidden" role="tablist">
        {([['sessions', 'Itineraries', MessageSquare], ['chat', 'Chat', MessageSquare], ['preview', 'Preview', FileText]] as const).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={pane === k} onClick={() => setPane(k)} className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold ${pane === k ? 'bg-purple-50 text-purple-700' : 'text-slate-500'}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
            {k === 'preview' && project?.current_version_id && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
          </button>
        ))}
      </div>
      <div className={`${STUDIO_H} lg:hidden`}>
        {pane === 'sessions' && sessions}
        {pane === 'chat' && chat}
        {pane === 'preview' && preview}
      </div>

      {/* Desktop: three panels */}
      <div className={`hidden gap-3 lg:grid ${STUDIO_H}`} style={{ gridTemplateColumns: cols }}>
        {leftOpen && sessions}
        {chat}
        {rightOpen && preview}
      </div>

      {renaming && (
        <ConfirmDialog
          open
          title="Rename itinerary"
          confirmLabel="Save"
          body={
            <input
              autoFocus
              value={renaming.title}
              maxLength={140}
              onChange={(e) => setRenaming({ ...renaming, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { patchProject(renaming.id, { title: renaming.title }, 'Renamed'); setRenaming(null); } }}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
            />
          }
          onConfirm={() => { if (renaming.title.trim()) { patchProject(renaming.id, { title: renaming.title }, 'Renamed'); setRenaming(null); } }}
          onClose={() => setRenaming(null)}
        />
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        danger
        busy={busy}
        title="Delete this itinerary?"
        body={<>“{confirmDelete?.title}” — its conversation, all PDF versions and reference files will be permanently deleted. This can’t be undone. Archive it instead if you might need it later.</>}
        confirmLabel="Delete permanently"
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  );
}
