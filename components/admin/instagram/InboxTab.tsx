'use client';

import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Paperclip, RefreshCw, Send, ChevronDown, MessageCircle as MessageCircleIcon, BarChart3, Search, X, ArrowDown } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { Skeleton, timeAgo } from '@/components/admin/dashboard/utils';
import { NetBars } from './charts';
import { Avatar, Button, Dot, Empty, Panel, PanelHeader, Segmented, StoryRing, cx } from './shared';
import { mediaThumb, type InboxData, type MediaData, type ReplyTemplate, type ThreadMessage } from './types';

/*
 * Performance notes (why this file is shaped the way it is):
 * - Each text box owns its draft state (Composer / ReplyBox), so typing re-renders only
 *   the box — not the chat list or a 200-message thread.
 * - The list and the thread are memo'd; the 30s background poll only re-renders what changed.
 * - Threads are cached per chat: switching back is instant, no skeleton flash.
 * - The thread scrolls its own container (never scrollIntoView, which also scrolls the page).
 * - CSS: overscroll-contain stops scroll from chaining to the page, content-visibility:auto
 *   skips layout/paint of off-screen rows, field-sizing:content grows the textarea without JS.
 */

const WINDOW = 86_400_000;
const short = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const stamp = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Scroll areas: own their scroll, keep a steady gutter, momentum on touch. */
const SCROLLER = 'gk-scroll-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]';
/** Off-screen rows are skipped by the browser until they scroll near the viewport. */
const LAZY_ROW = '[content-visibility:auto]';

type Msg = ThreadMessage & { pending?: boolean };
type Conversation = InboxData['conversations'][number];

export default function InboxTab({ inbox, media, templates, onChanged, onSync, syncing }: {
  inbox: InboxData | null; media: MediaData | null; templates: ReplyTemplate[]; onChanged: () => void; onSync: () => void; syncing: boolean;
}) {
  const [view, setView] = useState<'messages' | 'comments'>('messages');
  const dmTemplates = useMemo(() => templates.filter((x) => x.kind === 'dm' && x.is_active), [templates]);
  const commentTemplates = useMemo(() => templates.filter((x) => x.kind === 'comment' && x.is_active), [templates]);

  if (!inbox) return <Skeleton className="h-[560px] rounded-xl" />;
  const t = inbox.today;
  const waitingChats = inbox.conversations.filter((c) => c.last.direction === 'in' && Date.now() - new Date(c.last.created_at).getTime() < WINDOW).length;
  const waitingComments = inbox.comments.filter((c) => !c.replied).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={view} onChange={(v) => setView(v as any)} options={[
          { k: 'messages', l: <>Messages{waitingChats > 0 && <span className="ml-1.5 tabular-nums text-slate-400">{waitingChats}</span>}</> },
          { k: 'comments', l: <>Comments{waitingComments > 0 && <span className="ml-1.5 tabular-nums text-slate-400">{waitingComments}</span>}</> },
        ]} />
        <p className="text-xs text-slate-500">
          Today: <b className="font-medium text-slate-900">{t.dmsIn}</b> messages from {t.people}, <b className="font-medium text-slate-900">{t.peopleReplied}</b> answered · <b className="font-medium text-slate-900">{t.comments}</b> comments, <b className="font-medium text-slate-900">{t.commentsReplied}</b> answered
        </p>
        <div className="ml-auto flex items-center gap-2">
          {inbox.automation?.last_sync_at && <span className="hidden text-xs text-slate-400 sm:inline">Synced {timeAgo(inbox.automation.last_sync_at)}</span>}
          <Button onClick={onSync} loading={syncing} icon={<RefreshCw className="h-3.5 w-3.5" />}>Sync</Button>
        </div>
      </div>

      {view === 'messages'
        ? <Messages conversations={inbox.conversations} templates={dmTemplates} onChanged={onChanged} />
        : <Comments comments={inbox.comments} media={media} templates={commentTemplates} onChanged={onChanged} />}

      <Trend days={inbox.days} />
    </div>
  );
}

/* ───────────── Messages: list left, thread right ───────────── */

function Messages({ conversations, templates, onChanged }: { conversations: Conversation[]; templates: ReplyTemplate[]; onChanged: () => void }) {
  const { toast } = useAdminLive();
  const [filter, setFilter] = useState<'waiting' | 'all'>('all');
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLowerCase());
  const [openId, setOpenId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, Msg[]>>({});

  const list = useMemo(() => conversations.filter((c) =>
    (filter === 'all' || c.last.direction === 'in') &&
    (!q || (c.username || '').toLowerCase().includes(q) || (c.last.text || '').toLowerCase().includes(q))), [conversations, filter, q]);
  const open = useMemo(() => conversations.find((c) => c.id === openId) || null, [conversations, openId]);
  const thread = openId ? threads[openId] ?? null : null;

  // Pick the first chat on wide screens so the right pane is never empty.
  useEffect(() => {
    if (!openId && list[0] && window.matchMedia('(min-width: 1024px)').matches) setOpenId(list[0].id);
  }, [list, openId]);

  const loadThread = useCallback(async (id: string) => {
    try {
      const j = await fetch(`/api/admin/instagram/inbox?conversation=${encodeURIComponent(id)}`, { cache: 'no-store' }).then((r) => r.json());
      setThreads((t) => ({ ...t, [id]: j.messages || [] }));
    } catch {
      setThreads((t) => (t[id] ? t : { ...t, [id]: [] }));
    }
  }, []);

  // Load on open (cached copy shows instantly); reload when that chat gets a new message.
  useEffect(() => { if (openId) loadThread(openId); }, [openId, open?.last.id, loadThread]);

  const lastIn = useMemo(() => (thread ? [...thread].reverse().find((m) => m.direction === 'in') : null), [thread]);
  const canReply = !!open?.user_id && !!lastIn && Date.now() - new Date(lastIn.created_at).getTime() < WINDOW;

  // Optimistic: the bubble appears the moment you press Enter, then the real thread replaces it.
  const send = useCallback(async (text: string) => {
    if (!open) return false;
    const id = open.id;
    const temp: Msg = { id: `tmp-${Date.now()}`, direction: 'out', text, has_attachment: false, is_auto: false, created_at: new Date().toISOString(), pending: true };
    setThreads((t) => ({ ...t, [id]: [...(t[id] || []), temp] }));
    try {
      const res = await fetch('/api/admin/instagram/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'dm', userId: open.user_id, conversationId: id, username: open.username, text }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not send');
      await loadThread(id);
      onChanged();
      return true;
    } catch (e: any) {
      setThreads((t) => ({ ...t, [id]: (t[id] || []).filter((m) => m.id !== temp.id) }));
      toast(e.message, 'error');
      return false;
    }
  }, [open, loadThread, onChanged, toast]);

  return (
    <Panel className="grid grid-cols-1 h-[calc(100dvh-8.5rem)] min-h-[460px] overflow-hidden lg:h-[calc(100dvh-7.5rem)] lg:max-h-[860px] lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* List */}
      <div className={cx('flex min-h-0 flex-col border-slate-200 lg:border-r', open && 'hidden lg:flex')}>
        <div className="space-y-2.5 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Messages</p>
            <Segmented size="xs" value={filter} onChange={(v) => setFilter(v as any)} options={[{ k: 'all', l: 'All' }, { k: 'waiting', l: 'Waiting' }]} />
          </div>
          <label className="flex h-9 items-center gap-2 rounded-xl bg-slate-100 px-3 text-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-200">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or message" aria-label="Search chats"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="rounded p-0.5 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>}
          </label>
        </div>
        {list.length === 0
          ? <Empty title={q ? 'No match' : filter === 'waiting' ? 'Nobody is waiting' : 'No chats yet'}>{q ? `Nothing for “${query.trim()}”.` : filter === 'waiting' ? 'Every chat has a reply.' : 'Chats appear after the first sync.'}</Empty>
          : <ChatList list={list} openId={openId} onOpen={setOpenId} />}
      </div>

      {/* Thread */}
      <div className={cx('flex min-h-0 flex-col', !open && 'hidden lg:flex')}>
        {!open ? <div className="m-auto"><Empty title="Select a chat">Pick a conversation to read it and reply.</Empty></div> : (
          <>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <button onClick={() => setOpenId(null)} className="-ml-1 grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Back to chats"><ArrowLeft className="h-[18px] w-[18px]" /></button>
              <StoryRing active={open.last.direction === 'in'}><Avatar name={open.username} size={30} /></StoryRing>
              <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-slate-900">{open.username || 'Instagram user'}</p><p className="text-[11px] text-slate-400">Instagram · {short(open.last.created_at)}</p></div>
              {open.username && (
                <a href={`https://www.instagram.com/${open.username}/`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-200/80">
                  <span className="hidden sm:inline">View profile</span><span className="sm:hidden">Profile</span> <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>

            <Thread chatId={open.id} messages={thread} />

            <div className="border-t border-slate-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {thread && canReply ? (
                <Composer key={open.id} username={open.username} templates={templates} onSend={send} />
              ) : (
                <p className="px-1 py-1.5 text-xs text-slate-500">
                  {!thread ? 'Loading…' : lastIn ? 'More than 24 hours since their last message — Instagram only allows replies from the app now.' : 'They haven’t written yet — you can reply once they message you.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

/** Chat list. Arrow keys move between chats; rows off-screen are skipped by the browser. */
const ChatList = memo(function ChatList({ list, openId, onOpen }: { list: Conversation[]; openId: string | null; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLUListElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const i = list.findIndex((c) => c.id === openId);
    const next = list[Math.min(list.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (!next) return;
    e.preventDefault();
    onOpen(next.id);
    ref.current?.querySelector<HTMLButtonElement>(`[data-id="${CSS.escape(next.id)}"]`)?.focus({ preventScroll: false });
  };
  return (
    <ul ref={ref} onKeyDown={onKey} className={SCROLLER}>
      {list.map((c) => {
        const waiting = c.last.direction === 'in';
        const on = c.id === openId;
        return (
          <li key={c.id} className={cx(LAZY_ROW, '[contain-intrinsic-size:auto_64px]')}>
            <button data-id={c.id} onClick={() => onOpen(c.id)} aria-current={on || undefined}
              className={cx('flex w-full touch-manipulation items-center gap-3 border-l-2 px-4 py-3 text-left focus-visible:bg-slate-50 focus-visible:outline-none',
                on ? 'border-pink-500 bg-pink-50/50' : 'border-transparent hover:bg-slate-50 active:bg-slate-100')}>
              {waiting ? <StoryRing><Avatar name={c.username} size={36} /></StoryRing> : <span className="p-[4.5px]"><Avatar name={c.username} size={36} /></span>}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={cx('truncate text-[13px]', waiting ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>{c.username || 'Instagram user'}</span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400">{short(c.last.created_at)}</span>
                </div>
                <p className={cx('mt-0.5 flex items-center gap-1.5 text-xs', waiting ? 'text-slate-700' : 'text-slate-400')}>
                  {waiting && <span className="h-2 w-2 shrink-0 rounded-full bg-[#0095f6]" />}
                  {c.last.direction === 'out' && <span className="shrink-0">{c.last.is_auto ? 'Auto:' : 'You:'}</span>}
                  <span className="truncate">{c.last.text || 'Sent an attachment'}</span>
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
});

/** Message thread. Sticks to the bottom only while you are at the bottom, so reading older messages is never interrupted. */
const Thread = memo(function Thread({ chatId, messages }: { chatId: string; messages: Msg[] | null }) {
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastChat = useRef<string | null>(null);
  const [showJump, setShowJump] = useState(false);

  const rows = useMemo(() => (messages || []).map((m, i, all) => {
    const prev = all[i - 1];
    const gap = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 30 * 60_000;
    const sameSideNext = all[i + 1]?.direction === m.direction;
    return { m, label: gap ? stamp(m.created_at) : null, tail: !sameSideNext };
  }), [messages]);

  const toBottom = (smooth = false) => { const el = box.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); };

  // Before paint, so a newly opened chat never flashes at the top first.
  useLayoutEffect(() => {
    if (!messages) return;
    const changed = lastChat.current !== chatId;
    const mineJustSent = messages[messages.length - 1]?.pending;
    if (changed || atBottom.current || mineJustSent) { toBottom(); atBottom.current = true; setShowJump(false); }
    lastChat.current = chatId;
  }, [chatId, messages]);

  const onScroll = () => {
    const el = box.current!;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottom.current = near;
    if (showJump === near) setShowJump(!near);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={box} onScroll={onScroll} className={cx(SCROLLER, 'bg-white px-4 py-4')}>
        {!messages ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className={cx('h-9 w-2/3', i % 2 && 'ml-auto')} />)}</div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">No messages synced for this chat yet.</p>
        ) : rows.map(({ m, label, tail }) => {
          const mine = m.direction === 'out';
          return (
            <div key={m.id} className={tail ? 'pb-2' : 'pb-0.5'}>
              {label && <p className="py-2 text-center text-[11px] text-slate-400">{label}</p>}
              <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cx('max-w-[78%] rounded-[22px] px-4 py-2 text-[14px] leading-[1.45] sm:max-w-[70%]',
                  mine ? 'bg-[linear-gradient(135deg,#8a3ffc_0%,#5b5bf7_55%,#0095f6_100%)] text-white' : 'bg-[#efefef] text-slate-900',
                  tail && (mine ? 'rounded-br-md' : 'rounded-bl-md'),
                  m.pending && 'opacity-60')}>
                  {m.text ? <span className="whitespace-pre-wrap break-words">{m.text}</span> : <span className={cx('inline-flex items-center gap-1 italic', mine ? 'text-white/70' : 'text-slate-400')}><Paperclip className="h-3 w-3" />Attachment</span>}
                  {m.is_auto && <span className="ml-2 inline-flex items-center rounded-full bg-white/20 px-1.5 align-middle text-[9px] font-bold uppercase tracking-wide text-white">auto</span>}
                </div>
              </div>
              {m.pending && <p className="mt-0.5 text-right text-[10px] text-slate-400">Sending…</p>}
            </div>
          );
        })}
      </div>
      {showJump && (
        <button onClick={() => toBottom(true)} aria-label="Jump to latest"
          className="absolute bottom-3 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50">
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});

/** Owns its draft, so keystrokes never re-render the list or thread. */
function Composer({ username, templates, onSend }: { username: string | null; templates: ReplyTemplate[]; onSend: (text: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useAutosize(ta, draft);

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft('');
    const ok = await onSend(text);
    if (!ok) setDraft(text);
    setBusy(false);
    ta.current?.focus();
  };

  return (
    <>
      <div className="flex items-end gap-2">
        <SavedPicker templates={templates} onPick={(text) => { setDraft(text.replace(/\{username\}/gi, username ? `@${username}` : '').trim()); ta.current?.focus(); }} />
        <textarea ref={ta} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={1000} enterKeyHint="send"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          placeholder="Message…" className="max-h-36 min-h-[40px] flex-1 resize-none rounded-[20px] border border-slate-200 px-4 py-2.5 text-[14px] leading-5 [field-sizing:content] focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100" />
        <Button variant="primary" onClick={submit} loading={busy} disabled={!draft.trim()} icon={<Send className="h-3.5 w-3.5" />} className="h-10 rounded-full px-4" aria-label="Send">
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
      <p className="mt-1.5 hidden truncate text-[11px] text-slate-400 sm:block" title="↑ ↓ in the chat list switches chats">Enter to send · Shift + Enter for a new line</p>
    </>
  );
}

/** Grows the textarea with its text. Uses CSS field-sizing where supported (Chrome/Edge), JS elsewhere. */
function useAutosize(ref: React.RefObject<HTMLTextAreaElement>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content'))) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [ref, value]);
}

function SavedPicker({ templates, onPick }: { templates: ReplyTemplate[]; onPick: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!templates.length) return null;
  return (
    <div className="relative">
      <Button variant="soft" onClick={() => setOpen((o) => !o)} className="h-10 rounded-full" aria-expanded={open}>Saved <ChevronDown className={cx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} /></Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute bottom-11 left-0 z-20 max-h-64 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 shadow-lg animate-slide-up">
            {templates.map((t) => (
              <li key={t.id}>
                <button onClick={() => { onPick(t.text); setOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50">
                  <span className="line-clamp-2">{t.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ───────────── Comments ───────────── */

function Comments({ comments, media, templates, onChanged }: { comments: InboxData['comments']; media: MediaData | null; templates: ReplyTemplate[]; onChanged: () => void }) {
  const [filter, setFilter] = useState<'waiting' | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const thumbs = useMemo(() => new Map((media?.media || []).map((m) => [m.id, mediaThumb(m)])), [media]);
  const list = useMemo(() => (filter === 'waiting' ? comments.filter((c) => !c.replied) : comments), [comments, filter]);
  const close = useCallback(() => setOpenId(null), []);

  return (
    <Panel className="overflow-hidden">
      <PanelHeader icon={<MessageCircleIcon />} tone="orange" title="Comments" description="Newest first, from your recent posts"
        right={<Segmented size="xs" value={filter} onChange={(v) => setFilter(v as any)} options={[{ k: 'all', l: 'All' }, { k: 'waiting', l: 'Waiting' }]} />} />
      {list.length === 0 ? <Empty title={filter === 'waiting' ? 'Nothing waiting' : 'No comments yet'}>{filter === 'waiting' ? 'Every comment has a reply.' : 'Comments appear after the first sync.'}</Empty> : (
        <ul className="divide-y divide-slate-100">
          {list.map((c) => (
            <CommentRow key={c.id} c={c} thumb={thumbs.get(c.media_id)} open={openId === c.id} templates={templates}
              onOpen={setOpenId} onClose={close} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

const CommentRow = memo(function CommentRow({ c, thumb, open, templates, onOpen, onClose, onChanged }: {
  c: InboxData['comments'][number]; thumb?: string; open: boolean; templates: ReplyTemplate[];
  onOpen: (id: string) => void; onClose: () => void; onChanged: () => void;
}) {
  return (
    <li className={cx('flex gap-4 px-5 py-4', !open && cx(LAZY_ROW, '[contain-intrinsic-size:auto_96px]'))}>
      <a href={c.media_permalink || '#'} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Open post">
        {thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" width={48} height={64} className="h-16 w-12 rounded-lg bg-slate-100 object-cover" />
          : <span className="block h-16 w-12 rounded-lg bg-slate-100" />}
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-semibold text-slate-900">{c.username || 'Instagram user'}</span>
          <span className="text-[11px] text-slate-400">{timeAgo(c.created_at)}</span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
            <Dot tone={c.replied ? 'green' : 'amber'} />{c.replied ? (c.reply_source === 'auto' ? 'Auto replied' : 'Answered') : 'Waiting'}
          </span>
        </div>
        <p className="mt-1 break-words text-[13px] leading-relaxed text-slate-700">{c.text}</p>
        {c.reply_text && <p className="mt-2 border-l-2 border-slate-200 pl-3 text-xs text-slate-500"><span className="font-medium text-slate-700">You · </span>{c.reply_text}</p>}
        {open
          ? <ReplyBox id={c.id} username={c.username} templates={templates} onClose={onClose} onChanged={onChanged} />
          : !c.replied && <button onClick={() => onOpen(c.id)} className="-ml-2 mt-1 rounded-md px-2 py-1.5 text-xs font-semibold text-[#0095f6] hover:bg-sky-50 hover:text-[#00376b]">Reply</button>}
      </div>
    </li>
  );
});

function ReplyBox({ id, username, templates, onClose, onChanged }: { id: string; username: string | null; templates: ReplyTemplate[]; onClose: () => void; onChanged: () => void }) {
  const { toast } = useAdminLive();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useAutosize(ta, draft);

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/instagram/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'comment', id, text: draft }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not reply');
      toast('Reply posted', 'success');
      onClose();
      onChanged();
    } catch (e: any) { toast(e.message, 'error'); setSending(false); }
  };

  return (
    <div className="mt-3 space-y-2">
      {templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {templates.slice(0, 5).map((t) => (
            <button key={t.id} onClick={() => { setDraft(t.text.replace(/\{username\}/gi, username ? `@${username}` : '').trim()); ta.current?.focus(); }}
              className="max-w-[240px] truncate rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:border-slate-300 hover:text-slate-900">{t.text}</button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea ref={ta} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={300} enterKeyHint="send"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } if (e.key === 'Escape') onClose(); }}
          placeholder={`Reply to ${username || 'comment'}…`} className="max-h-32 min-h-[36px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[13px] leading-5 [field-sizing:content] focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100" />
        <Button variant="ghost" size="sm" onClick={onClose} className="h-9">Cancel</Button>
        <Button variant="primary" size="sm" onClick={send} loading={sending} disabled={!draft.trim()} className="h-9">Reply</Button>
      </div>
    </div>
  );
}

/* ───────────── 14-day trend ───────────── */

const Trend = memo(function Trend({ days }: { days: InboxData['days'] }) {
  const [metric, setMetric] = useState<'dms' | 'comments'>('dms');
  const bars = useMemo(() => days.map((d) => ({
    key: d.date,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    net: metric === 'dms' ? d.dmsIn : d.comments,
    close: metric === 'dms' ? d.people : d.comments,
  })), [days, metric]);
  return (
    <Panel>
      <PanelHeader icon={<BarChart3 />} gradient title="Last 14 days" description="Counted from the first sync onwards"
        right={<Segmented size="xs" value={metric} onChange={(v) => setMetric(v as any)} options={[{ k: 'dms', l: 'Messages' }, { k: 'comments', l: 'Comments' }]} />} />
      <div className="px-3 pb-3 pt-4"><NetBars bars={bars} height={170} closeLabel={metric === 'dms' ? 'people' : 'comments'} emptyText="Nothing synced yet." /></div>
    </Panel>
  );
});
