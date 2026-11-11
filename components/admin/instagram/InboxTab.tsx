'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Paperclip, RefreshCw, Send, ChevronDown, MessageCircle as MessageCircleIcon, BarChart3 } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { Skeleton, timeAgo } from '@/components/admin/dashboard/utils';
import { NetBars } from './charts';
import { Avatar, Button, Dot, Empty, Panel, PanelHeader, Segmented, StoryRing, cx } from './shared';
import { mediaThumb, type InboxData, type MediaData, type ReplyTemplate, type ThreadMessage } from './types';

const WINDOW = 86_400_000;
const short = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function InboxTab({ inbox, media, templates, onChanged, onSync, syncing }: {
  inbox: InboxData | null; media: MediaData | null; templates: ReplyTemplate[]; onChanged: () => void; onSync: () => void; syncing: boolean;
}) {
  const [view, setView] = useState<'messages' | 'comments'>('messages');

  if (!inbox) return <Skeleton className="h-[560px] rounded-xl" />;
  const t = inbox.today;
  const waitingChats = inbox.conversations.filter((c) => c.last.direction === 'in' && Date.now() - new Date(c.last.created_at).getTime() < WINDOW).length;
  const waitingComments = inbox.comments.filter((c) => !c.replied).length;

  return (
    <div className="space-y-6">
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
        ? <Messages inbox={inbox} templates={templates.filter((x) => x.kind === 'dm' && x.is_active)} onChanged={onChanged} />
        : <Comments inbox={inbox} media={media} templates={templates.filter((x) => x.kind === 'comment' && x.is_active)} onChanged={onChanged} />}

      <Trend inbox={inbox} />
    </div>
  );
}

/* ───────────── Messages: list left, thread right ───────────── */

function Messages({ inbox, templates, onChanged }: { inbox: InboxData; templates: ReplyTemplate[]; onChanged: () => void }) {
  const { toast } = useAdminLive();
  const [filter, setFilter] = useState<'waiting' | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => inbox.conversations.filter((c) => filter === 'all' || c.last.direction === 'in'), [inbox, filter]);
  const open = inbox.conversations.find((c) => c.id === openId) || null;

  // Pick the first chat on wide screens so the right pane is never empty.
  useEffect(() => {
    if (!openId && list[0] && window.matchMedia('(min-width: 1024px)').matches) setOpenId(list[0].id);
  }, [list, openId]);

  const loadThread = (id: string) =>
    fetch(`/api/admin/instagram/inbox?conversation=${encodeURIComponent(id)}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => setThread(j.messages || [])).catch(() => setThread([]));

  // Load on open; reload when that chat gets a new message. One request either way.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!openId) return;
    if (shown.current !== openId) { shown.current = openId; setThread(null); setDraft(''); }
    loadThread(openId);
  }, [openId, open?.last.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread]);

  const lastIn = thread ? [...thread].reverse().find((m) => m.direction === 'in') : null;
  const canReply = !!open?.user_id && !!lastIn && Date.now() - new Date(lastIn.created_at).getTime() < WINDOW;

  const send = async () => {
    if (!open || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/instagram/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'dm', userId: open.user_id, conversationId: open.id, username: open.username, text: draft }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not send');
      setDraft('');
      await loadThread(open.id);
      onChanged();
    } catch (e: any) { toast(e.message, 'error'); } finally { setSending(false); }
  };

  return (
    <Panel className="grid h-[640px] overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* List */}
      <div className={cx('flex min-h-0 flex-col border-slate-200 lg:border-r', open && 'hidden lg:flex')}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <p className="text-[15px] font-bold text-slate-900">Messages</p>
          <Segmented size="xs" value={filter} onChange={(v) => setFilter(v as any)} options={[{ k: 'all', l: 'All' }, { k: 'waiting', l: 'Waiting' }]} />
        </div>
        {list.length === 0 ? <Empty title={filter === 'waiting' ? 'Nobody is waiting' : 'No chats yet'}>{filter === 'waiting' ? 'Every chat has a reply.' : 'Chats appear after the first sync.'}</Empty> : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {list.map((c) => {
              const waiting = c.last.direction === 'in';
              const on = c.id === openId;
              return (
                <li key={c.id}>
                  <button onClick={() => setOpenId(c.id)} className={cx('flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors', on ? 'border-pink-500 bg-pink-50/40' : 'border-transparent hover:bg-slate-50/70')}>
                    {waiting ? <StoryRing><Avatar name={c.username} size={36} /></StoryRing> : <span className="p-[4.5px]"><Avatar name={c.username} size={36} /></span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={cx('truncate text-[13px]', waiting ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>{c.username || 'Instagram user'}</span>
                        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400">{short(c.last.created_at)}</span>
                      </div>
                      <p className={cx('mt-0.5 flex items-center gap-1.5 truncate text-xs', waiting ? 'text-slate-700' : 'text-slate-400')}>
                        {waiting && <span className="h-2 w-2 shrink-0 rounded-full bg-[#0095f6]" />}
                        {c.last.direction === 'out' && <span>{c.last.is_auto ? 'Auto:' : 'You:'}</span>}
                        <span className="truncate">{c.last.text || 'Sent an attachment'}</span>
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Thread */}
      <div className={cx('flex min-h-0 flex-col', !open && 'hidden lg:flex')}>
        {!open ? <div className="m-auto"><Empty title="Select a chat">Pick a conversation to read it and reply.</Empty></div> : (
          <>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <button onClick={() => setOpenId(null)} className="-ml-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back to chats"><ArrowLeft className="h-4 w-4" /></button>
              <StoryRing active={open.last.direction === 'in'}><Avatar name={open.username} size={30} /></StoryRing>
              <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-slate-900">{open.username || 'Instagram user'}</p><p className="text-[11px] text-slate-400">Instagram · {short(open.last.created_at)}</p></div>
              {open.username && (
                <a href={`https://www.instagram.com/${open.username}/`} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-200/80">View profile <ArrowUpRight className="h-3 w-3" /></a>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-white px-4 py-4">
              {!thread ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className={cx('h-9 w-2/3', i % 2 && 'ml-auto')} />)}</div> : thread.map((m, i) => {
                const mine = m.direction === 'out';
                const prev = thread[i - 1];
                const gap = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 30 * 60_000;
                return (
                  <div key={m.id}>
                    {gap && <p className="py-2 text-center text-[11px] text-slate-400">{new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>}
                    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cx('max-w-[75%] rounded-3xl px-4 py-2 text-[13px] leading-relaxed', mine ? 'rounded-br-md bg-[linear-gradient(135deg,#8a3ffc_0%,#5b5bf7_55%,#0095f6_100%)] text-white shadow-sm' : 'rounded-bl-md bg-[#efefef] text-slate-900')}>
                        {m.text ? <span className="whitespace-pre-wrap break-words">{m.text}</span> : <span className={cx('inline-flex items-center gap-1 italic', mine ? 'text-white/70' : 'text-slate-400')}><Paperclip className="h-3 w-3" />Attachment</span>}
                        {m.is_auto && <span className="ml-2 inline-flex items-center rounded-full bg-white/20 px-1.5 align-middle text-[9px] font-bold uppercase tracking-wide text-white">auto</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Composer: saved replies → text → send (right) */}
            <div className="border-t border-slate-100 bg-white p-3">
              {canReply ? (
                <>
                  <div className="flex items-end gap-2">
                    <SavedPicker templates={templates} onPick={(text) => setDraft(text.replace(/\{username\}/gi, open.username ? `@${open.username}` : '').trim())} />
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={1000}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Message…" className="max-h-32 min-h-[40px] flex-1 resize-none rounded-[20px] border border-slate-200 px-4 py-2.5 text-[13px] focus:border-slate-300 focus:outline-none" />
                    <Button variant="primary" onClick={send} loading={sending} disabled={!draft.trim()} icon={<Send className="h-3.5 w-3.5" />} className="h-10 rounded-full px-4">Send</Button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">Enter to send · Shift + Enter for a new line</p>
                </>
              ) : (
                <p className="px-1 py-1.5 text-xs text-slate-500">
                  {lastIn ? 'More than 24 hours since their last message — Instagram only allows replies from the app now.' : 'They haven’t written yet — you can reply once they message you.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function SavedPicker({ templates, onPick }: { templates: ReplyTemplate[]; onPick: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!templates.length) return null;
  return (
    <div className="relative">
      <Button variant="soft" onClick={() => setOpen((o) => !o)} className="h-10 rounded-full" aria-expanded={open}>Saved <ChevronDown className="h-3.5 w-3.5" /></Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute bottom-11 left-0 z-20 max-h-64 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg animate-slide-up">
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

function Comments({ inbox, media, templates, onChanged }: { inbox: InboxData; media: MediaData | null; templates: ReplyTemplate[]; onChanged: () => void }) {
  const { toast } = useAdminLive();
  const [filter, setFilter] = useState<'waiting' | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const thumbs = useMemo(() => new Map((media?.media || []).map((m) => [m.id, mediaThumb(m)])), [media]);
  const list = filter === 'waiting' ? inbox.comments.filter((c) => !c.replied) : inbox.comments;

  const send = async (id: string) => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/instagram/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'comment', id, text: draft }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not reply');
      toast('Reply posted', 'success');
      setOpenId(null); setDraft('');
      onChanged();
    } catch (e: any) { toast(e.message, 'error'); } finally { setSending(false); }
  };

  return (
    <Panel className="overflow-hidden">
      <PanelHeader icon={<MessageCircleIcon />} tone="orange" title="Comments" description="Newest first, from your recent posts"
        right={<Segmented size="xs" value={filter} onChange={(v) => setFilter(v as any)} options={[{ k: 'all', l: 'All' }, { k: 'waiting', l: 'Waiting' }]} />} />
      {list.length === 0 ? <Empty title={filter === 'waiting' ? 'Nothing waiting' : 'No comments yet'}>{filter === 'waiting' ? 'Every comment has a reply.' : 'Comments appear after the first sync.'}</Empty> : (
        <ul className="divide-y divide-slate-100">
          {list.map((c) => {
            const thumb = thumbs.get(c.media_id);
            return (
              <li key={c.id} className="flex gap-4 px-5 py-4">
                <a href={c.media_permalink || '#'} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Open post">
                  {thumb
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-12 rounded-lg bg-slate-100 object-cover" />
                    : <span className="block h-14 w-11 rounded-md bg-slate-100" />}
                </a>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-semibold text-slate-900">{c.username || 'Instagram user'}</span>
                    <span className="text-[11px] text-slate-400">{timeAgo(c.created_at)}</span>
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
                      <Dot tone={c.replied ? 'green' : 'amber'} />{c.replied ? (c.reply_source === 'auto' ? 'Auto replied' : 'Answered') : 'Waiting'}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-slate-700">{c.text}</p>
                  {c.reply_text && <p className="mt-2 border-l-2 border-slate-200 pl-3 text-xs text-slate-500"><span className="font-medium text-slate-700">You · </span>{c.reply_text}</p>}

                  {openId === c.id ? (
                    <div className="mt-3 space-y-2">
                      {templates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {templates.slice(0, 5).map((t) => (
                            <button key={t.id} onClick={() => setDraft(t.text.replace(/\{username\}/gi, c.username ? `@${c.username}` : '').trim())}
                              className="max-w-[240px] truncate rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:border-slate-300 hover:text-slate-900">{t.text}</button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={300}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(c.id); } if (e.key === 'Escape') setOpenId(null); }}
                          placeholder={`Reply to ${c.username || 'comment'}…`} className="min-h-[34px] flex-1 resize-none rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] focus:border-slate-400 focus:outline-none" />
                        <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>Cancel</Button>
                        <Button variant="primary" size="sm" onClick={() => send(c.id)} loading={sending} disabled={!draft.trim()}>Reply</Button>
                      </div>
                    </div>
                  ) : !c.replied && (
                    <button onClick={() => { setOpenId(c.id); setDraft(''); }} className="mt-2 text-xs font-semibold text-[#0095f6] hover:text-[#00376b]">Reply</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ───────────── 14-day trend ───────────── */

function Trend({ inbox }: { inbox: InboxData }) {
  const [metric, setMetric] = useState<'dms' | 'comments'>('dms');
  const bars = inbox.days.map((d) => ({
    key: d.date,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    net: metric === 'dms' ? d.dmsIn : d.comments,
    close: metric === 'dms' ? d.people : d.comments,
  }));
  return (
    <Panel>
      <PanelHeader icon={<BarChart3 />} gradient title="Last 14 days" description="Counted from the first sync onwards"
        right={<Segmented size="xs" value={metric} onChange={(v) => setMetric(v as any)} options={[{ k: 'dms', l: 'Messages' }, { k: 'comments', l: 'Comments' }]} />} />
      <div className="px-3 pb-3 pt-4"><NetBars bars={bars} height={150} gradient closeLabel={metric === 'dms' ? 'people' : 'comments'} emptyText="Nothing synced yet." /></div>
    </Panel>
  );
}
