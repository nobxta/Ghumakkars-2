'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, PauseCircle, AlertTriangle, Check, X, ChevronUp, ChevronDown, Hash, MessagesSquare, MessageCircle, Moon, Map, Link2,
  ShieldCheck, Bot, Sparkles, Image as ImageIcon, Globe, Pencil,
} from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { Skeleton, timeAgo } from '@/components/admin/dashboard/utils';
import RuleEditor, { blankReply, blankRule } from './RuleEditor';
import { Banner, Button, Dot, IconChip, Panel, PanelHeader, Segmented, Switch, cx } from './shared';
import type { AutomationSettings, IgMediaItem, InboxData, ReplyRule, RulesData } from './types';

const KIND: Record<string, string> = { dm: 'Message', comment: 'Comment', comment_dm: 'Comment → DM' };
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

/** Ready-made rules — one click fills the editor, then tweak and save. */
function starters(channel: 'dm' | 'comment', site: string): { name: string; desc: string; icon: React.ReactNode; rule: ReplyRule }[] {
  const trips = site ? `${site}/trips` : 'https://';
  if (channel === 'dm') {
    return [
      {
        name: 'Price enquiry', desc: 'price, cost, kitna… → prices + button', icon: <Hash />,
        rule: { ...blankRule('dm'), name: 'Price enquiry', keywords: ['price', 'cost', 'kitna', 'charges', 'fees', 'rate'], replies: [
          { ...blankReply('dm', true), text: 'Hi {username}! 🙌 Our trips start from ₹2,999 per person. See every trip with dates and prices below 👇', buttons: [{ title: 'View all trips', url: trips }] },
        ] },
      },
      {
        name: 'Upcoming trips', desc: 'trips, dates, schedule… → live trip cards', icon: <Map />,
        rule: { ...blankRule('dm'), name: 'Upcoming trips', keywords: ['trips', 'upcoming', 'next trip', 'dates', 'schedule', 'plan'], replies: [
          { ...blankReply('dm', true), format: 'trips', text: 'Here are our upcoming trips {username} ✨ Swipe to see them all 👉', options: { trips_limit: 5, trip_button: 'View trip' } },
        ] },
      },
      {
        name: 'Night-time away message', desc: '9 pm – 9 am, once a day', icon: <Moon />,
        rule: { ...blankRule('dm'), name: 'Night-time away message', trigger: 'any', active_from: 21, active_to: 9, cooldown_hours: 24, replies: [
          { ...blankReply('dm', true), text: 'Thanks for your message {username}! 🌙 Our team is offline right now and will reply first thing in the morning.', quick_replies: ['Upcoming trips', 'Prices'] },
        ] },
      },
      {
        name: 'Welcome message', desc: 'Anything else, once a day, with quick replies', icon: <Sparkles />,
        rule: { ...blankRule('dm'), name: 'Welcome message', trigger: 'any', cooldown_hours: 24, replies: [
          { ...blankReply('dm', true), text: 'Hey {username}! 👋 Welcome to Ghumakkars. What would you like to know?', quick_replies: ['Upcoming trips', 'Prices', 'Talk to team'] },
        ] },
      },
    ];
  }
  return [
    {
      name: 'Comment “details” → DM', desc: 'details, info, price → reply + DM with trips', icon: <Hash />,
      rule: { ...blankRule('comment'), name: 'Comment “details” → DM', keywords: ['details', 'detail', 'info', 'price', 'dm', 'interested'], send_dm: true, replies: [
        { ...blankReply('comment', true), text: 'Sent you the details in DM {username} 📩' },
        { ...blankReply('comment'), text: 'Check your DMs {username} ✨' },
        { ...blankReply('dm', true), format: 'trips', text: 'Hey {username}! Here are the details you asked for 👇', options: { trips_limit: 5, trip_button: 'View trip' } },
      ] },
    },
    {
      name: 'Thank every comment', desc: 'Random thank-you replies', icon: <MessageCircle />,
      rule: { ...blankRule('comment'), name: 'Thank every comment', trigger: 'any', replies: [
        { ...blankReply('comment', true), text: 'Thank you {username} ❤️' },
        { ...blankReply('comment'), text: 'Means a lot {username} 🙌' },
        { ...blankReply('comment'), text: 'Glad you liked it {username} ✨' },
      ] },
    },
  ];
}

export default function AutomationTab({ settings, inbox, media, profile, onChanged, onSync, syncing }: {
  settings: AutomationSettings | null; inbox: InboxData | null; media: IgMediaItem[]; profile?: { username?: string; picture?: string | null };
  onChanged: () => void; onSync: (resume?: boolean) => void; syncing: boolean;
}) {
  const { toast } = useAdminLive();
  const [channel, setChannel] = useState<'dm' | 'comment'>('dm');
  const [data, setData] = useState<RulesData | null>(null);
  const [editing, setEditing] = useState<ReplyRule | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [site, setSite] = useState('');

  const load = useCallback(() => fetch('/api/admin/instagram/rules', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (!j.error) { setData(j); setSite(j.siteUrlConfigured || ''); } }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  if (!settings || !data) return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"><Skeleton className="h-[520px] rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;

  const save = async (patch: Record<string, unknown>, msg?: string) => {
    setSaving(Object.keys(patch)[0]);
    try {
      const res = await fetch('/api/admin/instagram/automation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not save');
      if (msg) toast(msg, 'success');
    } catch (e: any) { toast(e.message, 'error'); } finally { setSaving(null); onChanged(); load(); }
  };

  const rules = data.rules.filter((r) => r.channel === channel).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const on = channel === 'dm' ? settings.dm_enabled : settings.comment_enabled;
  const paused = !!settings.paused_until && new Date(settings.paused_until).getTime() > Date.now();
  const stale = !settings.last_sync_at || Date.now() - new Date(settings.last_sync_at).getTime() > 10 * 60_000;
  const recentError = settings.last_error && settings.last_error_at && Date.now() - new Date(settings.last_error_at).getTime() < 6 * 3600_000;

  const toggleRule = async (r: ReplyRule, v: boolean) => {
    setData((d) => d && { ...d, rules: d.rules.map((x) => (x.id === r.id ? { ...x, is_active: v } : x)) });
    const res = await fetch('/api/admin/instagram/rules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, is_active: v }) });
    if (!res.ok) { toast('Could not update the rule', 'error'); load(); }
  };
  const move = async (i: number, dir: -1 | 1) => {
    const ids = rules.map((r) => r.id!);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setData((d) => d && { ...d, rules: d.rules.map((x) => (ids.includes(x.id!) ? { ...x, position: ids.indexOf(x.id!) * 10 } : x)) });
    await fetch('/api/admin/instagram/rules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: ids }) });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={channel} onChange={(v) => setChannel(v as any)} options={[
            { k: 'dm', l: <span className="inline-flex items-center gap-1.5"><Dot tone={settings.dm_enabled ? 'green' : 'gray'} />Messages</span> },
            { k: 'comment', l: <span className="inline-flex items-center gap-1.5"><Dot tone={settings.comment_enabled ? 'green' : 'gray'} />Comments</span> },
          ]} />
          <p className="text-xs text-slate-500">Rules are checked top to bottom — the first one that matches replies.</p>
        </div>

        {paused && (
          <Banner tone="amber" icon={<PauseCircle className="h-4 w-4" />} title="Paused — Instagram asked us to slow down" action={<Button size="sm" onClick={() => onSync(true)}>Resume now</Button>}>
            Replies restart on their own at {new Date(settings.paused_until!).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.
          </Banner>
        )}
        {recentError && !paused && <Banner tone="rose" icon={<AlertTriangle className="h-4 w-4" />} title={`Something went wrong ${timeAgo(settings.last_error_at)}`}>{settings.last_error}</Banner>}

        {/* Master switch */}
        <Panel className={cx('overflow-hidden', on && 'ring-1 ring-emerald-200')}>
          <div className={cx('flex items-center gap-4 px-5 py-4', on && 'bg-gradient-to-r from-emerald-50/80 to-white')}>
            <IconChip icon={channel === 'dm' ? <MessagesSquare /> : <MessageCircle />} gradient={on} tone="purple" size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{channel === 'dm' ? 'Auto reply to messages' : 'Auto reply to comments'} <span className={cx('ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold', on ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600')}>{on ? 'ON' : 'OFF'}</span></p>
              <p className="mt-0.5 text-xs text-slate-500">{channel === 'dm' ? 'Answers new DMs using the rules below.' : 'Answers new comments on your latest posts using the rules below.'}</p>
            </div>
            <Switch label="Auto reply" on={on} disabled={saving !== null} onChange={(v) => save(channel === 'dm' ? { dm_enabled: v } : { comment_enabled: v }, v ? 'Auto reply is on' : 'Auto reply is off')} />
          </div>
          {channel === 'comment' && (
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-3 text-xs">
              <span className="text-slate-600">Watch comments on your latest</span>
              <div className="relative">
                <select value={settings.comment_posts_to_watch} onChange={(e) => save({ comment_posts_to_watch: Number(e.target.value) })} className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs text-slate-800">
                  {[3, 5, 10, 15, 25].map((n) => <option key={n} value={n}>{n} posts</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}
        </Panel>

        {/* Rules */}
        <Panel className="overflow-hidden">
          <PanelHeader icon={<Bot />} gradient title="Rules" description={`${rules.filter((r) => r.is_active).length} active · ${rules.reduce((s, r) => s + (r.stats?.sent || 0), 0)} replies sent this week`}
            right={<Button variant="gradient" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing(blankRule(channel))}>New rule</Button>} />
          {rules.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-slate-500">No rules yet. Start from one of the ideas below.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rules.map((r, i) => <RuleRow key={r.id} rule={r} index={i} count={rules.length} media={media} onEdit={() => setEditing(r)} onToggle={(v) => toggleRule(r, v)} onMove={(d) => move(i, d)} />)}
            </ul>
          )}
        </Panel>

        {/* Starters */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Start from an idea</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {starters(channel, data.siteUrl).map((s) => (
              <button key={s.name} onClick={() => setEditing(JSON.parse(JSON.stringify(s.rule)))}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-md hover:shadow-pink-500/5">
                <IconChip icon={s.icon} tone="pink" />
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-slate-900">{s.name}</span><span className="block truncate text-xs text-slate-500">{s.desc}</span></span>
                <Plus className="h-4 w-4 text-slate-300 group-hover:text-pink-500" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Side column */}
      <aside className="space-y-5 lg:sticky lg:top-20">
        <Panel>
          <div className="flex items-center gap-3 px-5 py-4">
            <Dot tone={paused ? 'amber' : stale ? 'gray' : 'green'} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-900">{paused ? 'Paused' : stale ? 'Not running' : 'Running'}</p>
              <p className="text-xs text-slate-500">{settings.last_sync_at ? `Checked ${timeAgo(settings.last_sync_at)}` : 'Never checked'} · every minute</p>
            </div>
            <Button size="sm" variant="soft" onClick={() => onSync()} loading={syncing}>Run now</Button>
          </div>
          {stale && !paused && <p className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-500">Replies only go out while the background job runs — in Coolify add a Scheduled Task <code className="rounded bg-slate-100 px-1 font-mono">npm run ig:cron</code> every minute.</p>}
        </Panel>

        <Panel>
          <PanelHeader icon={<Globe />} tone="blue" title="Your website" description="Used for trip cards and link presets" />
          <form className="flex gap-2 px-5 py-4" onSubmit={(e) => { e.preventDefault(); save({ site_url: site }, 'Website saved'); }}>
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder={data.siteUrl || 'https://yourdomain.com'}
              className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs focus:border-pink-300 focus:outline-none focus:ring-4 focus:ring-pink-50" />
            <Button size="sm" variant="soft" type="submit" loading={saving === 'site_url'}>Save</Button>
          </form>
          {!/^https:\/\//.test(data.siteUrl) && <p className="-mt-2 px-5 pb-4 text-[11px] text-amber-600">Instagram buttons need an https:// address.</p>}
        </Panel>

        <Panel>
          <PanelHeader icon={<ShieldCheck />} tone="green" title="Built-in safety" />
          <ul className="space-y-2.5 px-5 py-4 text-xs leading-relaxed text-slate-600">
            {[
              'Only replies to new messages and comments after you switch it on.',
              'Skips chats your team already answered.',
              'Each person is limited by the rule’s “how often”.',
              'If Instagram refuses buttons, the message goes as text with links.',
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

      {editing && (
        <RuleEditor initial={editing} media={media} data={data} profile={profile}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); onChanged(); }} />
      )}
    </div>
  );
}

function RuleRow({ rule, index, count, media, onEdit, onToggle, onMove }: {
  rule: ReplyRule; index: number; count: number; media: IgMediaItem[]; onEdit: () => void; onToggle: (v: boolean) => void; onMove: (d: -1 | 1) => void;
}) {
  const active = rule.replies.filter((r) => r.is_active);
  const has = (f: (r: ReplyRule['replies'][number]) => boolean) => active.some(f);
  const thumbs = rule.media_ids.map((id) => media.find((m) => m.id === id)).filter(Boolean).slice(0, 3) as IgMediaItem[];
  const when = rule.trigger === 'keywords'
    ? <>{rule.match_type === 'exact' ? 'Is exactly' : 'Contains'} {rule.keywords.slice(0, 4).map((k) => <span key={k} className="mx-0.5 rounded-md bg-pink-50 px-1.5 py-0.5 font-medium text-pink-700">{k}</span>)}{rule.keywords.length > 4 && <span className="text-slate-400"> +{rule.keywords.length - 4}</span>}</>
    : <>{rule.channel === 'dm' ? 'Any other message' : 'Any other comment'}</>;

  return (
    <li className={cx('group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/60', !rule.is_active && 'opacity-55')}>
      <div className="flex flex-col">
        <button onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-0.5 text-slate-300 hover:text-slate-700 disabled:invisible" aria-label="Move up"><ChevronUp className="h-3.5 w-3.5" /></button>
        <button onClick={() => onMove(1)} disabled={index === count - 1} className="rounded p-0.5 text-slate-300 hover:text-slate-700 disabled:invisible" aria-label="Move down"><ChevronDown className="h-3.5 w-3.5" /></button>
      </div>
      <IconChip icon={rule.trigger === 'keywords' ? <Hash /> : rule.active_from != null ? <Moon /> : <MessagesSquare />} tone={rule.trigger === 'keywords' ? 'pink' : rule.active_from != null ? 'indigo' : 'purple'} />
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[13px] font-semibold text-slate-900 group-hover:text-pink-700">{rule.name}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{when}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Tag>{active.length} {active.length === 1 ? 'reply' : 'replies'}{active.length > 1 ? (rule.reply_mode === 'random' ? ' · random' : ' · fixed') : ''}</Tag>
          {has((r) => r.buttons.length > 0) && <Tag icon={<Link2 className="h-3 w-3" />}>Buttons</Tag>}
          {has((r) => r.format === 'card') && <Tag icon={<ImageIcon className="h-3 w-3" />}>Card</Tag>}
          {has((r) => r.format === 'trips') && <Tag icon={<Map className="h-3 w-3" />}>Trip cards</Tag>}
          {has((r) => r.quick_replies.length > 0) && <Tag>Quick replies</Tag>}
          {rule.send_dm && <Tag icon={<MessagesSquare className="h-3 w-3" />}>+ DM</Tag>}
          {rule.active_from != null && <Tag icon={<Moon className="h-3 w-3" />}>{hourLabel(rule.active_from)}–{hourLabel(rule.active_to ?? 0)}</Tag>}
          {thumbs.length > 0 && (
            <span className="ml-1 flex -space-x-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumbs.map((m) => <img key={m.id} src={m.thumbnail_url || m.media_url} alt="" className="h-5 w-5 rounded-md object-cover ring-2 ring-white" referrerPolicy="no-referrer" />)}
              {rule.media_ids.length > 3 && <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[9px] font-bold text-slate-500 ring-2 ring-white">+{rule.media_ids.length - 3}</span>}
            </span>
          )}
        </div>
      </button>
      <div className="hidden text-right sm:block">
        <p className="text-sm font-bold tabular-nums text-slate-900">{rule.stats?.sent || 0}</p>
        <p className="text-[11px] text-slate-400">this week{rule.stats?.failed ? <span className="text-rose-500"> · {rule.stats.failed} failed</span> : ''}</p>
      </div>
      <Switch on={rule.is_active} onChange={onToggle} label={`Turn ${rule.name} ${rule.is_active ? 'off' : 'on'}`} />
      <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label="Edit rule"><Pencil className="h-4 w-4" /></button>
    </li>
  );
}

function Tag({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{icon}{children}</span>;
}
