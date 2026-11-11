'use client';

import { useState } from 'react';
import { Plus, Trash2, Star, PauseCircle, AlertTriangle, Info, Check, X, ChevronDown, Send, MessageCircle, ShieldCheck, Bot } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { Skeleton, timeAgo } from '@/components/admin/dashboard/utils';
import { Banner, Button, Dot, Panel, PanelHeader, Segmented, SettingRow, Switch, cx } from './shared';
import type { AutomationSettings, InboxData, ReplyTemplate } from './types';

const COOLDOWNS = [
  { v: 0, l: 'Every message' }, { v: 1, l: 'Once an hour' }, { v: 12, l: 'Once every 12 hours' },
  { v: 24, l: 'Once a day' }, { v: 168, l: 'Once a week' }, { v: 720, l: 'Once a month' },
];
const KIND: Record<string, string> = { dm: 'Message', comment: 'Comment', comment_dm: 'Comment → DM' };

export default function AutomationTab({ settings, templates, inbox, onChanged, onSync, syncing }: {
  settings: AutomationSettings | null; templates: ReplyTemplate[]; inbox: InboxData | null; onChanged: () => void; onSync: (resume?: boolean) => void; syncing: boolean;
}) {
  const { toast } = useAdminLive();
  const [saving, setSaving] = useState<string | null>(null);

  if (!settings) return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"><Skeleton className="h-[520px] rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;

  const save = async (patch: Partial<AutomationSettings>, msg?: string) => {
    setSaving(Object.keys(patch)[0]);
    try {
      const res = await fetch('/api/admin/instagram/automation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not save');
      if (msg) toast(msg, 'success');
    } catch (e: any) { toast(e.message, 'error'); } finally { setSaving(null); onChanged(); }
  };

  const paused = !!settings.paused_until && new Date(settings.paused_until).getTime() > Date.now();
  const stale = !settings.last_sync_at || Date.now() - new Date(settings.last_sync_at).getTime() > 10 * 60_000;
  const recentError = settings.last_error && settings.last_error_at && Date.now() - new Date(settings.last_error_at).getTime() < 6 * 3600_000;
  const dmT = templates.filter((t) => t.kind === 'dm');
  const cmT = templates.filter((t) => t.kind === 'comment');
  const select = 'h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-[13px] text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500/30';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {paused && (
          <Banner tone="amber" icon={<PauseCircle className="h-4 w-4" />} title="Paused — Instagram asked us to slow down"
            action={<Button size="sm" onClick={() => onSync(true)}>Resume now</Button>}>
            Replies restart on their own at {new Date(settings.paused_until!).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.
          </Banner>
        )}
        {recentError && !paused && <Banner tone="rose" icon={<AlertTriangle className="h-4 w-4" />} title={`Something went wrong ${timeAgo(settings.last_error_at)}`}>{settings.last_error}</Banner>}

        {/* Direct messages */}
        <Panel>
          <PanelHeader icon={<Send />} gradient title="Reply to messages" description="Answer everyone who sends you a DM."
            right={<Switch label="Reply to messages" on={settings.dm_enabled} disabled={saving === 'dm_enabled'} onChange={(v) => save({ dm_enabled: v }, v ? 'Message replies are on' : 'Message replies are off')} />} />
          <div className={cx('divide-y divide-slate-100 transition-opacity', !settings.dm_enabled && 'opacity-60')}>
            <SettingRow title="Which reply to send" description={settings.dm_mode === 'random' ? 'A different saved reply each time.' : 'The starred reply, for everyone.'}>
              <Segmented value={settings.dm_mode} onChange={(v) => save({ dm_mode: v as any })} options={[{ k: 'random', l: 'Random' }, { k: 'fixed', l: 'Same for everyone' }]} />
            </SettingRow>
            <SettingRow title="How often per person" description="Stops the same person getting the auto reply again and again.">
              <div className="relative">
                <select value={settings.dm_cooldown_hours} onChange={(e) => save({ dm_cooldown_hours: Number(e.target.value) })} className={select}>
                  {Array.from(new Set([...COOLDOWNS.map((c) => c.v), settings.dm_cooldown_hours])).map((v) => <option key={v} value={v}>{COOLDOWNS.find((c) => c.v === v)?.l || `Every ${v} hours`}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </SettingRow>
          </div>
          <Replies kind="dm" mode={settings.dm_mode} items={dmT} onChanged={onChanged} />
        </Panel>

        {/* Comments */}
        <Panel>
          <PanelHeader icon={<MessageCircle />} tone="orange" title="Reply to comments" description="Post a public reply under each new comment."
            right={<Switch label="Reply to comments" on={settings.comment_enabled} disabled={saving === 'comment_enabled'} onChange={(v) => save({ comment_enabled: v }, v ? 'Comment replies are on' : 'Comment replies are off')} />} />
          <div className={cx('divide-y divide-slate-100 transition-opacity', !settings.comment_enabled && 'opacity-60')}>
            <SettingRow title="Which reply to send" description={settings.comment_mode === 'random' ? 'A different saved reply each time.' : 'The starred reply, for everyone.'}>
              <Segmented value={settings.comment_mode} onChange={(v) => save({ comment_mode: v as any })} options={[{ k: 'random', l: 'Random' }, { k: 'fixed', l: 'Same for everyone' }]} />
            </SettingRow>
            <SettingRow title="Posts to watch" description="Your most recent posts and reels.">
              <div className="relative">
                <select value={settings.comment_posts_to_watch} onChange={(e) => save({ comment_posts_to_watch: Number(e.target.value) })} className={select}>
                  {[3, 5, 10, 15, 25].map((n) => <option key={n} value={n}>Latest {n}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </SettingRow>
            <SettingRow title="Also send them a DM" description="One private message per comment, using your message replies.">
              <Switch label="Also send a DM" on={settings.comment_dm_enabled} onChange={(v) => save({ comment_dm_enabled: v }, v ? 'Commenters will also get a DM' : 'Commenter DMs are off')} />
            </SettingRow>
          </div>
          <Replies kind="comment" mode={settings.comment_mode} items={cmT} onChanged={onChanged} />
        </Panel>
      </div>

      {/* Side column: status, rules, recent activity */}
      <aside className="space-y-6 lg:sticky lg:top-20">
        <Panel>
          <div className="flex items-center gap-3 px-5 py-4">
            <Dot tone={paused ? 'amber' : stale ? 'gray' : 'green'} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-900">{paused ? 'Paused' : stale ? 'Not running' : 'Running'}</p>
              <p className="text-xs text-slate-500">{settings.last_sync_at ? `Last checked ${timeAgo(settings.last_sync_at)}` : 'Never checked'} · every minute</p>
            </div>
            <Button size="sm" onClick={() => onSync()} loading={syncing}>Run now</Button>
          </div>
          {stale && !paused && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-500">
              Replies only go out while the background job runs. In Coolify add a Scheduled Task: <code className="rounded bg-slate-100 px-1 font-mono">npm run ig:cron</code> every minute.
            </p>
          )}
        </Panel>

        <Panel>
          <PanelHeader icon={<ShieldCheck />} tone="green" title="How it behaves" />
          <ul className="space-y-2.5 px-5 py-4 text-xs leading-relaxed text-slate-600">
            {[
              'Only answers messages and comments that arrive after you switch it on.',
              'Skips chats your team has already answered.',
              'Messages: Instagram allows replies within 24 hours of their last message.',
              'Never replies to your own comments or to replies.',
              'At most 15 replies a minute; pauses itself if Instagram pushes back.',
            ].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{t}</li>)}
          </ul>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader icon={<Bot />} tone="pink" title="Recent auto replies" />
          {!inbox || inbox.autoReplies.length === 0 ? <p className="px-5 py-8 text-center text-xs text-slate-500">Nothing sent yet.</p> : (
            <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
              {inbox.autoReplies.slice(0, 25).map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 text-xs">
                    {r.status === 'sent' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-rose-600" />}
                    <span className="truncate font-medium text-slate-900">{r.recipient || 'Instagram user'}</span>
                    <span className="text-slate-400">· {KIND[r.kind]}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-slate-400">{timeAgo(r.created_at)}</span>
                  </div>
                  <p className={cx('mt-1 line-clamp-2 pl-5 text-xs', r.status === 'failed' ? 'text-rose-600' : 'text-slate-500')}>{r.status === 'failed' ? r.error : r.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </aside>
    </div>
  );
}

function Replies({ kind, mode, items, onChanged }: { kind: 'dm' | 'comment'; mode: 'fixed' | 'random'; items: ReplyTemplate[]; onChanged: () => void }) {
  const { toast } = useAdminLive();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const max = kind === 'comment' ? 300 : 1000;

  const call = async (method: string, body?: unknown, query = '') => {
    const res = await fetch(`/api/admin/instagram/templates${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Failed');
  };
  const run = async (key: string, fn: () => Promise<unknown>, msg?: string) => {
    setBusy(key);
    try { await fn(); if (msg) toast(msg, 'success'); } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(null); onChanged(); }
  };
  const add = () => text.trim() && run('add', () => call('POST', { kind, text }).then(() => { setText(''); setAdding(false); }), 'Reply saved');

  return (
    <div className="border-t border-slate-200 bg-slate-50/40">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <p className="text-[13px] font-medium text-slate-900">Saved replies <span className="font-normal text-slate-400">{items.filter((t) => t.is_active).length} in use</span></p>
        {!adding && <Button size="sm" variant="soft" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>Add reply</Button>}
      </div>

      {items.length === 0 && !adding && (
        <p className="mx-5 mb-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500">
          Add at least one reply to switch this on.
        </p>
      )}

      {items.length > 0 && (
        <ul className="mx-5 mb-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {items.map((t) => (
            <li key={t.id} className="group flex items-start gap-3 px-3.5 py-3">
              <input type="checkbox" checked={t.is_active} onChange={(e) => run(t.id, () => call('PATCH', { id: t.id, is_active: e.target.checked }))}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-[#0095f6]" aria-label="Use this reply" title={t.is_active ? 'In use' : 'Not in use'} />
              <p className={cx('min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed', t.is_active ? 'text-slate-800' : 'text-slate-400 line-through decoration-slate-300')}>{t.text}</p>
              <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-400" title="Times sent">{t.use_count} sent</span>
              {mode === 'fixed' && (
                <button onClick={() => run(t.id, () => call('PATCH', { id: t.id, pinned: true }), 'Starred reply will be sent to everyone')}
                  className={cx('shrink-0 pt-0.5', t.pinned ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500')} title={t.pinned ? 'Sent to everyone' : 'Send this one to everyone'} aria-label="Star reply">
                  <Star className="h-3.5 w-3.5" fill={t.pinned ? 'currentColor' : 'none'} />
                </button>
              )}
              <button onClick={() => { if (window.confirm('Delete this saved reply?')) run(t.id, () => call('DELETE', undefined, `?id=${t.id}`), 'Reply deleted'); }}
                className="shrink-0 pt-0.5 text-slate-300 opacity-0 transition hover:text-rose-600 focus:opacity-100 group-hover:opacity-100" aria-label="Delete reply">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mx-5 mb-4 rounded-xl border border-pink-200 bg-white p-3 shadow-sm ring-4 ring-pink-50">
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={max}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); if (e.key === 'Escape') setAdding(false); }}
            placeholder={kind === 'dm' ? 'Hi {username}, thanks for your message! Our team will get back to you shortly.' : 'Thanks {username}! We have sent you the details in DM.'}
            className="w-full resize-none border-0 p-0 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0" />
          <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
            <span className="flex items-center gap-1 text-[11px] text-slate-400"><Info className="h-3 w-3" /><code className="font-mono">{'{username}'}</code> adds their @name · {text.length}/{max}</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setAdding(false); setText(''); }}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={add} loading={busy === 'add'} disabled={!text.trim()}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
