'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, PauseCircle, AlertTriangle, Check, X, ChevronUp, ChevronDown, Hash, MessagesSquare, MessageCircle, Moon, Map, Link2,
  ShieldCheck, Bot, Image as ImageIcon, Globe, Pencil, Star, VolumeX, FlaskConical, Users, CalendarDays, Timer, Hand, CircleSlash, UserRound,
} from 'lucide-react';
import { matchRule, type MessageKind } from '@/lib/instagram-tracker/rules-core';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { Skeleton, timeAgo } from '@/components/admin/dashboard/utils';
import RuleEditor from './RuleEditor';
import { CATEGORIES, blankRule, ruleTemplates, type TemplateCategory } from './ruleTemplates';
import { Banner, Button, Dot, IconChip, Panel, PanelHeader, Segmented, Switch, cx } from './shared';
import type { AutomationSettings, IgMediaItem, InboxData, ReplyRule, RulesData } from './types';

const KIND: Record<string, string> = { dm: 'Message', comment: 'Comment', comment_dm: 'Comment → DM' };
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

export default function AutomationTab({ settings, inbox, media, profile, mutes = [], onChanged, onSync, syncing }: {
  settings: AutomationSettings | null; inbox: InboxData | null; media: IgMediaItem[]; profile?: { username?: string; picture?: string | null };
  mutes?: { recipient_id: string; username: string | null; until: string }[];
  onChanged: () => void; onSync: (resume?: boolean) => void; syncing: boolean;
}) {
  const { toast } = useAdminLive();
  const [channel, setChannel] = useState<'dm' | 'comment'>('dm');
  const [data, setData] = useState<RulesData | null>(null);
  const [editing, setEditing] = useState<ReplyRule | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [site, setSite] = useState('');
  const [cat, setCat] = useState<TemplateCategory | 'all'>('all');

  const load = useCallback(() => fetch('/api/admin/instagram/rules', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
    if (j.error) return;
    // Rules saved before conditions existed get the defaults.
    j.rules = (j.rules || []).map((r: ReplyRule) => ({ ...r, action: r.action || 'reply', conditions: { ...blankRule(r.channel).conditions, ...(r.conditions || {}) } }));
    setData(j); setSite(j.siteUrlConfigured || '');
  }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const templates = useMemo(() => ruleTemplates(channel, data?.siteUrl || '', data?.destinations), [channel, data]);

  if (!settings || !data) return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><Skeleton className="h-[520px] rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;

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
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {paused && (
          <Banner tone="amber" icon={<PauseCircle className="h-4 w-4" />} title="Paused — Instagram asked us to slow down" action={<Button size="sm" onClick={() => onSync(true)}>Resume now</Button>}>
            Replies restart on their own at {new Date(settings.paused_until!).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.
          </Banner>
        )}
        {recentError && !paused && <Banner tone="rose" icon={<AlertTriangle className="h-4 w-4" />} title={`Something went wrong ${timeAgo(settings.last_error_at)}`}>{settings.last_error}</Banner>}

        {/* Channel + master switch in one bar */}
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5">
            <Segmented value={channel} onChange={(v) => setChannel(v as any)} options={[
              { k: 'dm', l: <span className="inline-flex items-center gap-1.5"><MessagesSquare className="h-3.5 w-3.5" />Messages<Dot tone={settings.dm_enabled ? 'green' : 'gray'} /></span> },
              { k: 'comment', l: <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />Comments<Dot tone={settings.comment_enabled ? 'green' : 'gray'} /></span> },
            ]} />
            <p className="min-w-0 flex-1 text-xs text-slate-500">{channel === 'dm' ? 'Answers new DMs with the rules below.' : 'Answers new comments on your latest posts.'}</p>
            <label className="flex shrink-0 items-center gap-2.5">
              <span className={cx('text-[13px] font-semibold', on ? 'text-emerald-700' : 'text-slate-500')}>{on ? 'Auto reply on' : 'Auto reply off'}</span>
              <Switch label="Auto reply" on={on} disabled={saving !== null} onChange={(v) => save(channel === 'dm' ? { dm_enabled: v } : { comment_enabled: v }, v ? 'Auto reply is on' : 'Auto reply is off')} />
            </label>
          </div>
          {channel === 'comment' && (
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-2.5 text-xs sm:px-5">
              <span className="text-slate-600">Watch comments on your latest</span>
              <div className="relative">
                <select value={settings.comment_posts_to_watch} onChange={(e) => save({ comment_posts_to_watch: Number(e.target.value) })} className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-800">
                  {[3, 5, 10, 15, 25].map((n) => <option key={n} value={n}>{n} posts</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}
        </Panel>

        {/* Rules */}
        <Panel className="overflow-hidden">
          <PanelHeader title="Rules" description={`${rules.filter((r) => r.is_active).length} active · ${rules.reduce((s, r) => s + (r.stats?.sent || 0), 0)} sent this week · first match wins`}
            right={<Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing(blankRule(channel))}>New rule</Button>} />
          {rules.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-slate-500">No rules yet. Start from a template below.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rules.map((r, i) => <RuleRow key={r.id} rule={r} index={i} count={rules.length} media={media} onEdit={() => setEditing(r)} onToggle={(v) => toggleRule(r, v)} onMove={(d) => move(i, d)} />)}
            </ul>
          )}
        </Panel>

        <Simulator rules={rules} channel={channel} />

        {/* Templates */}
        <Panel className="overflow-hidden">
          <PanelHeader title="Start from a template" description="Ready-made rules for common situations — opens in the editor, nothing is saved until you create it"
            right={<Segmented size="xs" value={cat} onChange={(v) => setCat(v as any)} options={CATEGORIES.filter((c) => c.k === 'all' || templates.some((t) => t.category === c.k)).map((c) => ({ k: c.k, l: c.l }))} />} />
          <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
            {templates.filter((t) => cat === 'all' || t.category === cat).map((t) => {
              const exists = rules.some((r) => r.name === t.rule.name);
              return (
                <button key={t.name} onClick={() => setEditing(JSON.parse(JSON.stringify(t.rule)))}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/60">
                  <IconChip icon={t.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">{t.name}{exists && <span className="rounded bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700">added</span>}</span>
                    <span className="block truncate text-xs text-slate-500">{t.desc}</span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-700" />
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Side column */}
      <aside className="grid gap-4 md:grid-cols-2 xl:sticky xl:top-20 xl:block xl:space-y-4">
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
          <PanelHeader icon={<Hand />} title="Hand over to your team" description="Keep the bot out of real conversations" />
          <div className="space-y-3 px-5 py-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-600">After someone from the team replies in a chat, stay quiet there for</span>
              <select value={settings.human_pause_hours ?? 12} onChange={(e) => save({ human_pause_hours: Number(e.target.value) }, 'Saved')}
                className="h-8 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800">
                {[0, 2, 6, 12, 24, 48, 168].map((h) => <option key={h} value={h}>{h === 0 ? 'Off' : h < 24 ? `${h} hours` : h === 168 ? '1 week' : `${h / 24} day${h > 24 ? 's' : ''}`}</option>)}
              </select>
            </label>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-700">Handed over now <span className="font-normal text-slate-400">· {mutes.length}</span></p>
              {mutes.length === 0 ? <p className="mt-1 text-[11px] text-slate-400">Rules with “Then hand over to the team” add people here.</p> : (
                <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                  {mutes.map((m) => (
                    <li key={m.recipient_id} className="flex items-center gap-2 text-xs">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-slate-800">@{m.username || m.recipient_id}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">until {new Date(m.until).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric' })}</span>
                      <button onClick={() => save({ unmute: m.recipient_id }, `Bot is back on for @${m.username || 'them'}`)} className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100">Resume</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
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
              'Each person is limited by the rule’s “how often”; rules can wait, cap per day, and hand over to the team.',
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
  const c = rule.conditions || {};
  const when = rule.trigger === 'keywords'
    ? <>{rule.match_type === 'exact' ? 'Is exactly' : rule.match_type === 'starts' ? 'Starts with' : c.keyword_logic === 'all' ? 'Has all of' : 'Contains'} {rule.keywords.slice(0, 4).map((k) => <span key={k} className="mx-0.5 rounded-md bg-pink-50 px-1.5 py-0.5 font-medium text-[#a3195b]">{k}</span>)}{rule.keywords.length > 4 && <span className="text-slate-400"> +{rule.keywords.length - 4}</span>}</>
    : rule.trigger === 'media' ? <>Photo, video or shared post</> : rule.trigger === 'story' ? <>Story reply or mention</>
    : <>{rule.channel === 'dm' ? 'Anything else' : 'Any other comment'}</>;
  const silent = rule.action === 'ignore';
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <li className={cx('group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-slate-50/70 sm:px-4', !rule.is_active && 'opacity-55')}>
      <div className="flex flex-col opacity-40 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-0.5 text-slate-300 hover:text-slate-700 disabled:invisible" aria-label="Move up"><ChevronUp className="h-3.5 w-3.5" /></button>
        <button onClick={() => onMove(1)} disabled={index === count - 1} className="rounded p-0.5 text-slate-300 hover:text-slate-700 disabled:invisible" aria-label="Move down"><ChevronDown className="h-3.5 w-3.5" /></button>
      </div>
      <IconChip icon={silent ? <VolumeX /> : rule.trigger === 'keywords' ? <Hash /> : rule.trigger === 'media' ? <ImageIcon /> : rule.trigger === 'story' ? <Star /> : rule.active_from != null ? <Moon /> : <MessagesSquare />} />
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[13px] font-semibold text-slate-900 group-hover:text-slate-950">{rule.name}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{when}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {silent ? <Tag icon={<VolumeX className="h-3 w-3" />}>Stays silent</Tag> : <Tag>{active.length} {active.length === 1 ? 'reply' : 'replies'}{active.length > 1 ? (rule.reply_mode === 'random' ? ' · random' : ' · fixed') : ''}</Tag>}
          {(c.exclude || []).length > 0 && <Tag icon={<CircleSlash className="h-3 w-3" />}>Skips {c.exclude!.length} word{c.exclude!.length > 1 ? 's' : ''}</Tag>}
          {c.audience === 'new' && <Tag icon={<Users className="h-3 w-3" />}>First message</Tag>}
          {c.audience === 'returning' && <Tag icon={<Users className="h-3 w-3" />}>Wrote before</Tag>}
          {c.follows === 'followers' && <Tag icon={<Users className="h-3 w-3" />}>Followers</Tag>}
          {c.follows === 'non_followers' && <Tag icon={<Users className="h-3 w-3" />}>Not following</Tag>}
          {(c.min_followers || 0) > 0 && <Tag icon={<Users className="h-3 w-3" />}>{(c.min_followers! / 1000).toLocaleString('en-IN')}K+ followers</Tag>}
          {(c.days || []).length > 0 && <Tag icon={<CalendarDays className="h-3 w-3" />}>{c.days!.map((d) => DAY[d]).join(', ')}</Tag>}
          {(c.starts_on || c.ends_on) && <Tag icon={<CalendarDays className="h-3 w-3" />}>{c.starts_on ? fmtDay(c.starts_on) : 'now'} – {c.ends_on ? fmtDay(c.ends_on) : '…'}</Tag>}
          {(c.delay_minutes || 0) > 0 && <Tag icon={<Timer className="h-3 w-3" />}>After {c.delay_minutes} min</Tag>}
          {(c.daily_limit || 0) > 0 && <Tag>Max {c.daily_limit}/day</Tag>}
          {(c.mute_hours || 0) > 0 && <Tag icon={<Hand className="h-3 w-3" />}>Hands over {c.mute_hours! >= 24 ? `${c.mute_hours! / 24}d` : `${c.mute_hours}h`}</Tag>}
          {c.skip_tags && <Tag>Skips tag-only</Tag>}
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
  return <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 [&:not(:last-child)]:after:ml-1.5 [&:not(:last-child)]:after:text-slate-300 [&:not(:last-child)]:after:content-['·']">{icon}{children}</span>;
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Type a message and see which rule would answer — and why the others wouldn't. Same logic as the engine. */
function Simulator({ rules, channel }: { rules: ReplyRule[]; channel: 'dm' | 'comment' }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<MessageKind>('text');
  const [isNew, setIsNew] = useState<'yes' | 'no'>('no');
  const [follows, setFollows] = useState<'yes' | 'no' | 'unknown'>('yes');
  const [followers, setFollowers] = useState(500);
  const [when, setWhen] = useState('');
  const isDm = channel === 'dm';

  const result = useMemo(() => {
    if (!text.trim() && kind === 'text') return null;
    const now = when ? new Date(`${when}:00+05:30`) : new Date();
    return matchRule(rules.map((r) => ({ ...r, conditions: r.conditions || {} })), {
      channel, text, kind: isDm ? kind : 'text', now,
      person: { isNew: isNew === 'yes', follows: follows === 'unknown' ? null : follows === 'yes', followers },
    });
  }, [rules, channel, text, kind, isNew, follows, followers, when, isDm]);

  const hit = result?.rule;
  return (
    <Panel className="overflow-hidden">
      <PanelHeader icon={<FlaskConical />} title="Test a message" description="Nothing is sent — see which rule would answer, and why" />
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={isDm ? 'e.g. manali trip price kitna hai?' : 'e.g. details please 🙌'}
            className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100" />
          {isDm && <Segmented value={kind} onChange={(v) => setKind(v as MessageKind)} options={[{ k: 'text', l: 'Text' }, { k: 'media', l: 'Photo/share' }, { k: 'story', l: 'Story reply' }]} />}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
          {isDm && <span className="flex items-center gap-1.5">First message <Segmented size="xs" value={isNew} onChange={(v) => setIsNew(v as any)} options={[{ k: 'no', l: 'No' }, { k: 'yes', l: 'Yes' }]} /></span>}
          <span className="flex items-center gap-1.5">Follows you <Segmented size="xs" value={follows} onChange={(v) => setFollows(v as any)} options={[{ k: 'yes', l: 'Yes' }, { k: 'no', l: 'No' }, { k: 'unknown', l: '?' }]} /></span>
          <span className="flex items-center gap-1.5">Their followers
            <select value={followers} onChange={(e) => setFollowers(Number(e.target.value))} className="h-6 rounded-md border border-slate-200 bg-white px-1 text-[11px]">
              {[100, 500, 2000, 6000, 20000, 100000].map((n) => <option key={n} value={n}>{n.toLocaleString('en-IN')}</option>)}
            </select>
          </span>
          <span className="flex items-center gap-1.5">At
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-6 rounded-md border border-slate-200 bg-white px-1 text-[11px]" />
            {!when && <span className="text-slate-400">now (IST)</span>}
          </span>
        </div>

        {result && (
          <div className="rounded-lg border border-slate-200">
            <div className={cx('flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-[13px]', hit ? (hit.action === 'ignore' ? 'bg-slate-50' : 'bg-emerald-50/60') : 'bg-amber-50/60')}>
              {hit ? (hit.action === 'ignore' ? <VolumeX className="h-4 w-4 text-slate-500" /> : <Check className="h-4 w-4 text-emerald-600" />) : <X className="h-4 w-4 text-amber-600" />}
              {hit ? <span><b className="font-semibold">{hit.name}</b> {hit.action === 'ignore' ? 'matches and stays silent' : 'would reply'}</span> : <span className="text-amber-800">No rule matches — nothing is sent</span>}
              {hit && ((hit.conditions?.delay_minutes || 0) > 0 || hit.cooldown_hours > 0) && <span className="ml-auto text-[11px] text-slate-500">{[(hit.conditions?.delay_minutes || 0) > 0 && `after ${hit.conditions!.delay_minutes} min`, hit.cooldown_hours > 0 && `if not answered in ${hit.cooldown_hours}h`].filter(Boolean).join(' · ')}</span>}
            </div>
            <ul className="divide-y divide-slate-100">
              {result.trace.map((t, i) => (
                <li key={`${t.id || t.rule}-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', t.ok ? 'bg-emerald-500' : 'bg-slate-300')} />
                  <span className={cx('min-w-0 flex-1 truncate', t.ok ? 'font-medium text-slate-900' : 'text-slate-600')}>{t.rule}</span>
                  <span className="shrink-0 text-right text-[11px] text-slate-400">{t.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
