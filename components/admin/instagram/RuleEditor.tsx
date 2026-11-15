'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  X, Hash, MessagesSquare, Plus, Trash2, Star, Type, CreditCard, Map, Link2, MousePointerClick, Send, Check, Image as ImageIcon, Braces, MessageCircle, VolumeX,
  Zap, Users, CalendarDays, Timer, ChevronDown,
} from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import ReplyPreview from './ReplyPreview';
import { Button, Segmented, Switch, cx } from './shared';
import { mediaThumb, type IgMediaItem, type ReplyRule, type RuleConditions, type RuleReply, type RulesData, type TripCardPreview } from './types';
import { blankReply, blankRule } from './ruleTemplates';
import { DEFAULT_FIELDS, type TripField } from '@/lib/instagram-tracker/trip-pick';

export interface LiveTrip { id: string; title: string; place: string; price: number; image: string | null; bookable: boolean; featured: boolean }

export { blankReply, blankRule };

const HOURS = Array.from({ length: 24 }, (_, h) => ({ v: h, l: `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}` }));
const COOLDOWNS = [
  { v: 0, l: 'Every time' }, { v: 1, l: 'Once an hour' }, { v: 6, l: 'Every 6 hours' }, { v: 24, l: 'Once a day' }, { v: 168, l: 'Once a week' }, { v: 720, l: 'Once a month' },
];
const DELAYS = [{ v: 0, l: 'Instantly' }, { v: 1, l: '1 min' }, { v: 2, l: '2 min' }, { v: 5, l: '5 min' }, { v: 15, l: '15 min' }, { v: 30, l: '30 min' }, { v: 60, l: '1 hour' }];
const CAPS = [{ v: 0, l: 'No cap' }, { v: 10, l: '10 a day' }, { v: 25, l: '25 a day' }, { v: 50, l: '50 a day' }, { v: 100, l: '100 a day' }, { v: 200, l: '200 a day' }];
const MUTES = [{ v: 0, l: 'No' }, { v: 2, l: '2 hours' }, { v: 24, l: '1 day' }, { v: 72, l: '3 days' }, { v: 168, l: '1 week' }, { v: 720, l: '30 days' }];
const DAYS = [{ l: 'S', full: 'Sunday' }, { l: 'M', full: 'Monday' }, { l: 'T', full: 'Tuesday' }, { l: 'W', full: 'Wednesday' }, { l: 'T', full: 'Thursday' }, { l: 'F', full: 'Friday' }, { l: 'S', full: 'Saturday' }];

export default function RuleEditor({ initial, media, data, profile, onClose, onSaved }: {
  initial: ReplyRule; media: IgMediaItem[]; data: RulesData; profile?: { username?: string; picture?: string | null };
  onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useAdminLive();
  const [rule, setRule] = useState<ReplyRule>(() => {
    const r = JSON.parse(JSON.stringify(initial));
    return { ...r, action: r.action || 'reply', conditions: { ...blankRule(r.channel).conditions, ...(r.conditions || {}) } };
  });
  const [focus, setFocus] = useState<{ kind: 'dm' | 'comment'; i: number }>({ kind: initial.channel === 'dm' ? 'dm' : 'comment', i: 0 });
  const [saving, setSaving] = useState(false);
  const [trips, setTrips] = useState<TripCardPreview[] | null>(null);
  const [tripName, setTripName] = useState<string | null>(null);
  const [liveTrips, setLiveTrips] = useState<LiveTrip[] | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [testTo, setTestTo] = useState(data.testTargets[0]?.user_id || '');
  const [testing, setTesting] = useState(false);
  // Trigger and reply start open; the rest fold to a summary (opened if a new rule needs them is up to you).
  const [openS, setOpenS] = useState<string[]>(['trigger', 'reply']);
  const isDm = rule.channel === 'dm';

  const set = (p: Partial<ReplyRule>) => setRule((r) => ({ ...r, ...p }));
  const c = rule.conditions;
  const setC = (p: Partial<RuleConditions>) => setRule((r) => ({ ...r, conditions: { ...r.conditions, ...p } }));
  const list = (kind: 'dm' | 'comment') => rule.replies.map((r, i) => ({ r, i })).filter((x) => x.r.kind === kind);
  const updateReply = (i: number, p: Partial<RuleReply>) => setRule((r) => ({ ...r, replies: r.replies.map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  const addReply = (kind: 'dm' | 'comment') => {
    setRule((r) => ({ ...r, replies: [...r.replies, blankReply(kind, !r.replies.some((x) => x.kind === kind))] }));
    setFocus({ kind, i: rule.replies.length });
  };
  const removeReply = (i: number) => setRule((r) => ({ ...r, replies: r.replies.filter((_, j) => j !== i) }));
  const pin = (i: number) => setRule((r) => ({ ...r, replies: r.replies.map((x, j) => (x.kind === r.replies[i].kind ? { ...x, pinned: j === i } : x)) }));

  // Close on Escape.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose, saving]);

  const dmReplies = list('dm');
  const pubReplies = list('comment');
  const previewDm = focus.kind === 'dm' ? rule.replies[focus.i] : dmReplies[0]?.r;

  // Live trips for the "pick trips" list (once).
  const usesTrips = rule.replies.some((r) => r.format === 'trips');
  useEffect(() => {
    if (!usesTrips || liveTrips) return;
    fetch('/api/admin/instagram/rules/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listTrips: true }) })
      .then((r) => r.json()).then((j) => setLiveTrips(j.trips || [])).catch(() => setLiveTrips([]));
  }, [usesTrips, liveTrips]);
  const previewPub = focus.kind === 'comment' ? rule.replies[focus.i] : pubReplies[0]?.r;
  const sample = rule.trigger === 'keywords' && rule.keywords[0] ? (isDm ? `Hi, ${rule.keywords[0]}?` : `${rule.keywords[0]}`)
    : rule.trigger === 'media' ? '📎 Shared a reel' : rule.trigger === 'story' ? '↩︎ Replied to your story: 😍' : isDm ? 'Hi! Is the Manali trip available?' : 'Details please 🙌';
  const silent = rule.action === 'ignore';
  const incoming = previewText ?? sample;
  const suggestions = (data.destinations || []).filter((d) => !rule.keywords.includes(d)).slice(0, 10);

  // The exact cards the preview message would get (same code as the live send), refreshed as options change.
  const tripReply = previewDm?.format === 'trips' ? previewDm : null;
  const tripKey = tripReply ? JSON.stringify([tripReply.options, incoming]) : '';
  useEffect(() => {
    if (!tripReply) return;
    const t = setTimeout(() => {
      fetch('/api/admin/instagram/rules/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewTrips: tripReply.options || {}, message: incoming }) })
        .then((r) => r.json()).then((j) => { setTrips(j.cards || []); setTripName(j.tripName || null); }).catch(() => setTrips([]));
    }, 300);
    return () => clearTimeout(t);
  }, [tripKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/instagram/rules', {
        method: rule.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, rule, replies: rule.replies }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not save');
      toast(rule.id ? 'Rule saved' : 'Rule created', 'success');
      onSaved();
    } catch (e: any) { toast(e.message, 'error'); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!rule.id || !window.confirm(`Delete the rule “${rule.name}”? Its replies are deleted too.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/instagram/rules?id=${rule.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not delete');
      toast('Rule deleted', 'success');
      onSaved();
    } catch (e: any) { toast(e.message, 'error'); setSaving(false); }
  };

  const sendTest = async () => {
    if (!previewDm || !testTo) return;
    setTesting(true);
    try {
      const target = data.testTargets.find((t) => t.user_id === testTo);
      const res = await fetch('/api/admin/instagram/rules/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply: previewDm, userId: testTo, username: target?.username }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not send');
      toast(j.fellBack ? 'Sent — as plain text (Instagram refused the buttons)' : `Test sent to @${target?.username || 'them'}`, j.fellBack ? 'info' : 'success');
    } catch (e: any) { toast(e.message, 'error'); } finally { setTesting(false); }
  };

  // One-line summaries for folded sections.
  const hourText = (h: number) => HOURS[h].l.replace(' ', '').toLowerCase();
  const pick = (opts: { v: number; l: string }[], v: number) => opts.find((o) => o.v === v)?.l || `${v}`;
  const summary = {
    trigger: rule.trigger === 'keywords'
      ? (rule.keywords.length ? `${rule.match_type === 'exact' ? 'Is exactly' : rule.match_type === 'starts' ? 'Starts with' : c.keyword_logic === 'all' ? 'Has all of' : 'Contains'} ${rule.keywords.slice(0, 3).join(', ')}${rule.keywords.length > 3 ? ` +${rule.keywords.length - 3}` : ''}` : 'Add keywords')
      : TRIGGERS.find((t) => t.k === rule.trigger)?.l || '',
    reply: silent ? 'Stays silent' : `${rule.replies.filter((r) => r.is_active).length} ${rule.replies.filter((r) => r.is_active).length === 1 ? 'reply' : 'replies'}${rule.replies.length > 1 ? (rule.reply_mode === 'random' ? ' · random' : ' · same for everyone') : ''}${!isDm && rule.send_dm ? ' · + DM' : ''}`,
    audience: [
      isDm ? ({ everyone: 'Everyone', new: 'First-time writers', returning: 'People who wrote before' } as const)[c.audience || 'everyone'] : 'Everyone',
      c.follows === 'followers' ? 'followers only' : c.follows === 'non_followers' ? 'non-followers only' : '',
      (c.min_followers || 0) > 0 ? `${(c.min_followers! / 1000).toLocaleString('en-IN')}K+ followers` : '',
    ].filter(Boolean).join(' · '),
    schedule: [
      rule.active_from == null ? 'All day' : `${hourText(rule.active_from)}–${hourText(rule.active_to ?? 9)}`,
      (c.days || []).length ? c.days!.map((d) => DAYS[d].full.slice(0, 3)).join(', ') : 'every day',
      c.starts_on || c.ends_on ? `${c.starts_on || 'now'} → ${c.ends_on || '…'}` : '',
    ].filter(Boolean).join(' · '),
    limits: [
      !silent ? pick(COOLDOWNS, rule.cooldown_hours).toLowerCase() : '',
      !silent && (c.delay_minutes || 0) > 0 ? `waits ${pick(DELAYS, c.delay_minutes!)}` : '',
      !silent && (c.daily_limit || 0) > 0 ? `max ${c.daily_limit}/day` : '',
      (c.mute_hours || 0) > 0 ? `hands over for ${pick(MUTES, c.mute_hours!).toLowerCase()}` : '',
    ].filter(Boolean).join(' · ') || 'No limits',
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-slate-900/40 backdrop-blur-[2px] sm:p-3 lg:p-4" onClick={() => !saving && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Edit rule" onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[1240px] flex-col overflow-hidden bg-white shadow-2xl animate-slide-up sm:rounded-2xl">
        {/* Header: name left, everything you commit with on the right */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-3 sm:gap-3 sm:px-4">
          <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close"><X className="h-[18px] w-[18px]" /></button>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 sm:inline-flex">
            {isDm ? <MessagesSquare className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}{isDm ? 'Message rule' : 'Comment rule'}
          </span>
          <input value={rule.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} autoFocus={!rule.id}
            placeholder="Name this rule"
            className="h-9 min-w-0 flex-1 rounded-lg px-2 text-[15px] font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none" />
          <button type="button" onClick={() => set({ is_active: !rule.is_active })} aria-pressed={rule.is_active}
            className={cx('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
              rule.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500')}>
            <span className={cx('h-1.5 w-1.5 rounded-full', rule.is_active ? 'bg-emerald-500' : 'bg-slate-300')} />{rule.is_active ? 'On' : 'Off'}
          </button>
          {rule.id && (
            <button onClick={remove} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete rule" title="Delete rule">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <span className="hidden h-6 w-px bg-slate-200 sm:block" />
          <Button variant="ghost" onClick={onClose} disabled={saving} className="hidden sm:inline-flex">Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving} icon={<Check className="h-3.5 w-3.5" />}>{rule.id ? 'Save' : 'Create'}</Button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto bg-slate-50 lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
          {/* Form */}
          <div className="gk-scroll-subtle min-w-0 lg:overflow-y-auto">
            <div className="mx-auto max-w-[760px] space-y-3 p-4 sm:p-6">
              {/* TRIGGER */}
              <Section id="trigger" open={openS} setOpen={setOpenS} icon={<Zap />} title="Trigger" summary={summary.trigger}>
                <div className={cx('grid gap-2', isDm ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}>
                  {TRIGGERS.filter((t) => isDm || t.k === 'keywords' || t.k === 'any').map((t) => (
                    <button key={t.k} type="button" onClick={() => set({ trigger: t.k })}
                      className={cx('flex flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        rule.trigger === t.k ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-white/60 hover:border-slate-300 hover:bg-white')}>
                      <t.Icon className={cx('h-4 w-4', rule.trigger === t.k ? 'text-[#d62976]' : 'text-slate-400')} />
                      <span className="text-[13px] font-semibold leading-tight text-slate-900">{t.k === 'any' && !isDm ? 'Any comment' : t.l}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">{TRIGGERS.find((t) => t.k === rule.trigger)?.d(isDm)}</p>

                {rule.trigger === 'keywords' && (
                  <Row label="Words" hint="Press Enter after each. Not case-sensitive.">
                    <KeywordInput value={rule.keywords} onChange={(k) => set({ keywords: k })} />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                      <span>Match when the message</span>
                      <MiniSelect value={rule.match_type} onChange={(v) => set({ match_type: v as any })} options={[['contains', 'contains'], ['starts', 'starts with'], ['exact', 'is exactly']]} />
                      <MiniSelect value={c.keyword_logic || 'any'} onChange={(v) => setC({ keyword_logic: v as any })} options={[['any', 'any of these'], ['all', 'all of these']]} />
                    </div>
                    {suggestions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">Your trips:</span>
                        {suggestions.map((d) => (
                          <button key={d} type="button" onClick={() => set({ keywords: [...rule.keywords, d].slice(0, 30) })}
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900">+ {d}</button>
                        ))}
                      </div>
                    )}
                  </Row>
                )}

                <Row label="Skip if it contains" hint="Leave these to your team.">
                  <KeywordInput tone="rose" value={c.exclude || []} onChange={(k) => setC({ exclude: k })} placeholder="refund, cancel, complaint…" />
                  {!(c.exclude || []).length && (
                    <button type="button" onClick={() => setC({ exclude: ['refund', 'cancel', 'complaint', 'problem'] })} className="mt-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-900">+ Add complaints and refunds</button>
                  )}
                </Row>

                {!isDm && (
                  <>
                    <Row label="Posts">
                      <Segmented size="xs" value={rule.media_ids.length ? 'some' : 'all'} onChange={(v) => set({ media_ids: v === 'all' ? [] : media.slice(0, 1).map((m) => m.id) })}
                        options={[{ k: 'all', l: 'All watched posts' }, { k: 'some', l: 'Only these' }]} />
                      {rule.media_ids.length > 0 && (
                        <div className="mt-2.5 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                          {media.slice(0, 24).map((m) => {
                            const on = rule.media_ids.includes(m.id);
                            return (
                              <button key={m.id} type="button" onClick={() => set({ media_ids: on ? rule.media_ids.filter((x) => x !== m.id) : [...rule.media_ids, m.id] })}
                                className={cx('relative aspect-[3/4] overflow-hidden rounded-lg transition', on ? 'ring-2 ring-[#d62976] ring-offset-1' : 'opacity-50 hover:opacity-100')}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={mediaThumb(m)} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d62976] text-white"><Check className="h-3 w-3" /></span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </Row>
                    <Row label="Tag-only comments" hint="“@friend 🔥🔥” has nothing to answer.">
                      <label className="flex items-center gap-2.5 text-[13px] text-slate-700"><Switch on={!!c.skip_tags} onChange={(v) => setC({ skip_tags: v })} label="Skip tag-only comments" />Skip them</label>
                    </Row>
                  </>
                )}
              </Section>

              {/* REPLY */}
              <Section id="reply" open={openS} setOpen={setOpenS} icon={<Send />} title="Reply" summary={summary.reply}
                right={<Segmented size="xs" value={silent ? 'ignore' : 'reply'} onChange={(v) => set({ action: v as any })} options={[{ k: 'reply', l: 'Reply' }, { k: 'ignore', l: 'Stay silent' }]} />}>
                {silent ? (
                  <div className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
                    <VolumeX className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p className="text-xs leading-relaxed text-slate-600">Nothing is sent, and no rule below this one runs for {isDm ? 'this message' : 'this comment'}. Use it for “ok / thanks”, complaints, or anything your team should answer by hand.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!isDm && (
                      <div className="space-y-2">
                        <GroupHead title="Public reply" hint="Under their comment" />
                        {pubReplies.map(({ r, i }) => (
                          <ReplyCard key={i} reply={r} kind="comment" mode={rule.reply_mode} siteUrl={data.siteUrl} selected={focus.kind === 'comment' && focus.i === i}
                            onSelect={() => setFocus({ kind: 'comment', i })} onChange={(p) => updateReply(i, p)} onRemove={() => removeReply(i)} onPin={() => pin(i)} />
                        ))}
                        <AddButton onClick={() => addReply('comment')}>Add a version</AddButton>
                      </div>
                    )}
                    {!isDm && (
                      <label className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
                        <span><span className="block text-[13px] font-semibold text-slate-900">Also send a DM</span><span className="block text-xs text-slate-500">One private message per comment — for details and links.</span></span>
                        <Switch on={rule.send_dm} onChange={(v) => { set({ send_dm: v }); if (v && !dmReplies.length) addReply('dm'); }} label="Also send a DM" />
                      </label>
                    )}
                    {(isDm || rule.send_dm) && (
                      <div className="space-y-2">
                        {!isDm && <GroupHead title="Direct message" hint="Sent privately" />}
                        {dmReplies.map(({ r, i }) => (
                          <ReplyCard key={i} reply={r} kind="dm" mode={rule.reply_mode} siteUrl={data.siteUrl} selected={focus.kind === 'dm' && focus.i === i}
                            onSelect={() => setFocus({ kind: 'dm', i })} onChange={(p) => updateReply(i, p)} onRemove={() => removeReply(i)} onPin={() => pin(i)} privateReply={!isDm} liveTrips={liveTrips} />
                        ))}
                        <AddButton onClick={() => addReply('dm')}>{dmReplies.length ? 'Add a version' : 'Add message'}</AddButton>
                      </div>
                    )}
                    {rule.replies.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>With several versions, send</span>
                        <Segmented size="xs" value={rule.reply_mode} onChange={(v) => set({ reply_mode: v as any })} options={[{ k: 'random', l: 'a random one' }, { k: 'fixed', l: 'the starred one' }]} />
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* AUDIENCE */}
              <Section id="audience" open={openS} setOpen={setOpenS} icon={<Users />} title="Audience" summary={summary.audience}>
                {isDm && (
                  <Row label="People">
                    <Segmented size="xs" value={c.audience || 'everyone'} onChange={(v) => setC({ audience: v as any })} options={[{ k: 'everyone', l: 'Everyone' }, { k: 'new', l: 'First message' }, { k: 'returning', l: 'Wrote before' }]} />
                  </Row>
                )}
                <Row label="Follows you">
                  <Segmented size="xs" value={c.follows || 'any'} onChange={(v) => setC({ follows: v as any })} options={[{ k: 'any', l: 'Anyone' }, { k: 'followers', l: 'Followers' }, { k: 'non_followers', l: 'Not following' }]} />
                </Row>
                <Row label="Their followers" hint="For creator and collab requests.">
                  <Select value={c.min_followers || 0} onChange={(v) => setC({ min_followers: v })} options={[0, 1000, 5000, 10000, 50000, 100000].map((n) => ({ v: n, l: n ? `${n.toLocaleString('en-IN')}+ followers` : 'Any size' }))} />
                </Row>
                {((c.follows && c.follows !== 'any') || (c.min_followers || 0) > 0) && (
                  <p className="pt-1 text-[11px] leading-relaxed text-slate-500">Checked with Instagram before replying. If Instagram doesn’t share it for someone, this rule is skipped and the next one is tried.</p>
                )}
              </Section>

              {/* SCHEDULE */}
              <Section id="schedule" open={openS} setOpen={setOpenS} icon={<CalendarDays />} title="Schedule" summary={summary.schedule}>
                <Row label="Hours" hint="India time">
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented size="xs" value={rule.active_from == null ? 'always' : 'hours'} onChange={(v) => set(v === 'always' ? { active_from: null, active_to: null } : { active_from: 21, active_to: 9 })}
                      options={[{ k: 'always', l: 'All day' }, { k: 'hours', l: 'Between' }]} />
                    {rule.active_from != null && (
                      <span className="flex items-center gap-1.5 text-xs text-slate-500">
                        <HourSelect value={rule.active_from} onChange={(v) => set({ active_from: v })} /> and <HourSelect value={rule.active_to ?? 9} onChange={(v) => set({ active_to: v })} />
                      </span>
                    )}
                  </div>
                </Row>
                <Row label="Days">
                  <div className="flex gap-1">
                    {DAYS.map((d, i) => {
                      const on = !(c.days || []).length || c.days!.includes(i);
                      return (
                        <button key={i} type="button" title={d.full} aria-pressed={on} onClick={() => {
                          const cur = (c.days || []).length ? c.days! : [0, 1, 2, 3, 4, 5, 6];
                          const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort();
                          setC({ days: next.length === 7 || next.length === 0 ? [] : next });
                        }}
                          className={cx('h-8 w-9 rounded-lg text-xs font-semibold transition-colors', on ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200 hover:text-slate-700')}>{d.full.slice(0, 2)}</button>
                      );
                    })}
                  </div>
                </Row>
                <Row label="Dates" hint="For offers and campaigns">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={c.starts_on || ''} onChange={(e) => setC({ starts_on: e.target.value || null })} className={cx(inputBase, 'h-8 w-auto py-0 text-xs')} aria-label="Starts on" />
                    <span className="text-xs text-slate-400">to</span>
                    <input type="date" value={c.ends_on || ''} min={c.starts_on || undefined} onChange={(e) => setC({ ends_on: e.target.value || null })} className={cx(inputBase, 'h-8 w-auto py-0 text-xs')} aria-label="Ends on" />
                    {(c.starts_on || c.ends_on) && <button type="button" onClick={() => setC({ starts_on: null, ends_on: null })} className="text-[11px] font-medium text-slate-500 hover:text-slate-900">Clear</button>}
                  </div>
                </Row>
              </Section>

              {/* LIMITS */}
              <Section id="limits" open={openS} setOpen={setOpenS} icon={<Timer />} title="Timing & limits" summary={summary.limits}>
                {!silent && (
                  <>
                    <Row label="Per person" hint={isDm ? undefined : 'For the public reply'}>
                      <Select value={rule.cooldown_hours} onChange={(v) => set({ cooldown_hours: v })} options={COOLDOWNS} />
                    </Row>
                    <Row label="Wait before replying" hint="Skipped if your team answers first.">
                      <Select value={c.delay_minutes || 0} onChange={(v) => setC({ delay_minutes: v })} options={DELAYS} />
                    </Row>
                    <Row label="Daily cap" hint="For giveaways and campaigns.">
                      <Select value={c.daily_limit || 0} onChange={(v) => setC({ daily_limit: v })} options={CAPS} />
                    </Row>
                  </>
                )}
                <Row label="Then hand over" hint="No more auto replies to this person for a while.">
                  <Select value={c.mute_hours || 0} onChange={(v) => setC({ mute_hours: v })} options={MUTES} />
                </Row>
              </Section>
            </div>
          </div>

          {/* Preview */}
          <aside className="gk-scroll-subtle flex flex-col border-t border-slate-200 bg-slate-100/70 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="flex-1 p-4 sm:p-5">
              <div className="mx-auto max-w-[340px]">
                <p className="mb-2 text-xs font-semibold text-slate-500">Preview</p>
                <label className="mb-3 flex h-9 items-center gap-2 rounded-lg bg-white px-3 ring-1 ring-slate-200 focus-within:ring-slate-300">
                  <span className="shrink-0 text-[11px] font-medium text-slate-400">{isDm ? 'They write' : 'They comment'}</span>
                  <input value={incoming} onChange={(e) => setPreviewText(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 focus:outline-none" aria-label="Preview message" />
                </label>
                <ReplyPreview channel={rule.channel} incoming={incoming} reply={!silent && (isDm || rule.send_dm) ? previewDm || null : null} publicReply={!isDm && !silent ? previewPub || null : undefined} trips={trips} tripName={tripName} profile={profile} />
                {tripReply && tripReply.options?.trip_pick === 'match' && (
                  <p className="mt-2.5 text-center text-[11px] text-slate-500">
                    {tripName ? <>Matched <b className="font-semibold text-slate-800">{tripName}</b></> : tripReply.options?.trip_fallback === 'text' ? 'No trip named — only the text is sent' : 'No trip named — upcoming trips are sent'}
                  </p>
                )}
                {silent && <p className="mt-3 text-center text-xs text-slate-500">Stays silent — nothing is sent.</p>}
              </div>
            </div>
            {!silent && (isDm || rule.send_dm) && previewDm && (
              <details className="group border-t border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-[13px] font-semibold text-slate-800 hover:bg-slate-50">
                  <Send className="h-3.5 w-3.5 text-slate-400" />Send a test to yourself<ChevronDown className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4">
                  {data.testTargets.length === 0 ? (
                    <p className="text-xs leading-relaxed text-slate-500">Message your business account from another Instagram account, wait a minute for the sync, then send yourself this reply.</p>
                  ) : (
                    <div className="flex gap-2">
                      <select value={testTo} onChange={(e) => setTestTo(e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                        {data.testTargets.map((t) => <option key={t.user_id} value={t.user_id}>@{t.username || t.user_id}</option>)}
                      </select>
                      <Button size="sm" variant="primary" onClick={sendTest} loading={testing}>Send</Button>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400">Buttons and cards show in the Instagram app, not on the web.</p>
                </div>
              </details>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ───────── pieces ───────── */

const TRIGGERS: { k: ReplyRule['trigger']; l: string; Icon: typeof Hash; d: (dm: boolean) => string }[] = [
  { k: 'keywords', l: 'Keywords', Icon: Hash, d: (dm) => `When the ${dm ? 'message' : 'comment'} has certain words.` },
  { k: 'media', l: 'Photo or share', Icon: ImageIcon, d: () => 'When they send a photo or video, or share a post or reel.' },
  { k: 'story', l: 'Story reply', Icon: Star, d: () => 'When they reply to your story or mention you in theirs.' },
  { k: 'any', l: 'Anything else', Icon: MessagesSquare, d: () => 'When no rule above it matches — your catch-all.' },
];

/** Collapsible section: a one-line summary when folded. */
function Section({ id, open, setOpen, icon, title, summary, right, children }: {
  id: string; open: string[]; setOpen: (f: (o: string[]) => string[]) => void; icon: React.ReactNode; title: string; summary: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  const on = open.includes(id);
  return (
    <section className="rounded-xl bg-white ring-1 ring-slate-200/90">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button type="button" onClick={() => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))} aria-expanded={on}
          className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            {!on && <span className="block truncate text-xs text-slate-500">{summary}</span>}
          </span>
          <ChevronDown className={cx('h-4 w-4 shrink-0 text-slate-400 transition-transform', on && 'rotate-180')} />
        </button>
        {on && right}
      </div>
      {on && <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5">{children}</div>}
    </section>
  );
}

/** Label on the left, control on the right; stacks on phones. */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-1.5 border-t border-slate-100 py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[150px_minmax(0,1fr)]">
      <div className="pt-1.5">
        <p className="text-[13px] font-medium text-slate-800">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function GroupHead({ title, hint }: { title: string; hint?: string }) {
  return <p className="flex items-baseline gap-2 text-[13px] font-semibold text-slate-900">{title}{hint && <span className="text-[11px] font-normal text-slate-400">{hint}</span>}</p>;
}

function Select({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: { v: number; l: string }[] }) {
  return (
    <div className="relative inline-block">
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-800 hover:border-slate-300 focus:border-slate-400 focus:outline-none">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/** A dropdown that reads as part of a sentence. */
function MiniSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <span className="relative inline-block">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-7 appearance-none rounded-md bg-slate-100 pl-2 pr-6 text-xs font-semibold text-slate-900 hover:bg-slate-200/70 focus:outline-none focus:ring-2 focus:ring-slate-200">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
    </span>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900 hover:ring-1 hover:ring-slate-200">
      <Plus className="h-3.5 w-3.5" />{children}
    </button>
  );
}

function HourSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800">
      {HOURS.map((h) => <option key={h.v} value={h.v}>{h.l}</option>)}
    </select>
  );
}

function KeywordInput({ value, onChange, tone = 'pink', placeholder }: { value: string[]; onChange: (v: string[]) => void; tone?: 'pink' | 'rose'; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const words = raw.split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (words.length) onChange(Array.from(new Set([...value, ...words])).slice(0, 30));
    setDraft('');
  };
  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-100">
      {value.map((k) => (
        <span key={k} className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', tone === 'rose' ? 'bg-slate-50 text-slate-700 ring-slate-200 line-through decoration-slate-300' : 'bg-pink-50 text-[#a3195b] ring-pink-200')}>
          {k}<button type="button" onClick={() => onChange(value.filter((x) => x !== k))} className="opacity-50 hover:opacity-100" aria-label={`Remove ${k}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft && add(draft)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); } if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
        placeholder={value.length ? 'Add more…' : placeholder || 'price, cost, details, manali…  (press Enter)'} className="min-w-[160px] flex-1 bg-transparent px-1 text-[13px] focus:outline-none" />
    </div>
  );
}

const FORMATS = [
  { k: 'text', l: 'Text', icon: Type, desc: 'Message with optional link buttons or quick replies' },
  { k: 'card', l: 'Card', icon: CreditCard, desc: 'Image, title and up to 3 buttons' },
  { k: 'trips', l: 'Trip cards', icon: Map, desc: 'Your live upcoming trips, swipeable' },
] as const;

function ReplyCard({ reply, kind, mode, siteUrl, selected, onSelect, onChange, onRemove, onPin, privateReply, liveTrips }: {
  reply: RuleReply; kind: 'dm' | 'comment'; mode: 'random' | 'fixed'; siteUrl: string; selected: boolean; privateReply?: boolean; liveTrips?: LiveTrip[] | null;
  onSelect: () => void; onChange: (p: Partial<RuleReply>) => void; onRemove: () => void; onPin: () => void;
}) {
  const isComment = kind === 'comment';
  const limit = isComment ? 300 : reply.format === 'card' ? 80 : reply.buttons.length ? 640 : 1000;
  const insert = (v: string) => onChange({ text: `${reply.text}${reply.text && !/\s$/.test(reply.text) ? ' ' : ''}${v}` });
  const presets = useMemo(() => [
    { title: 'Visit website', url: siteUrl || 'https://' },
    { title: 'View all trips', url: siteUrl ? `${siteUrl}/trips` : 'https://' },
    { title: 'Chat on WhatsApp', url: 'https://wa.me/91' },
  ], [siteUrl]);
  // Extras stay folded until used, so a plain message is just a text box.
  const [showButtons, setShowButtons] = useState(reply.buttons.length > 0);
  const [showQuick, setShowQuick] = useState(reply.quick_replies.length > 0);
  const buttonsOpen = reply.format === 'card' || showButtons || reply.buttons.length > 0;
  const quickOpen = showQuick || reply.quick_replies.length > 0;

  return (
    <div onClick={onSelect} className={cx('rounded-xl bg-white ring-1 transition-shadow', selected ? 'ring-slate-400 shadow-sm' : 'ring-slate-200 hover:ring-slate-300', !reply.is_active && 'opacity-60')}>
      <div className="flex items-center gap-2 px-3 pt-3">
        {!isComment ? (
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="Message type">
            {FORMATS.map((f) => (
              <button key={f.k} type="button" role="tab" aria-selected={reply.format === f.k} title={f.desc}
                onClick={() => onChange({ format: f.k, ...(f.k !== 'text' ? { quick_replies: [] } : {}), ...(f.k === 'trips' ? { buttons: [], options: { trips_limit: 5, trip_button: 'View trip', trip_pick: 'auto', trip_sort: 'featured', trip_fields: DEFAULT_FIELDS, ...reply.options } } : {}) })}
                className={cx('inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors', reply.format === f.k ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-900')}>
                <f.icon className="h-3.5 w-3.5" />{f.l}
              </button>
            ))}
          </div>
        ) : <span className="text-xs font-semibold text-slate-500">Public reply</span>}
        <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {mode === 'fixed' && (
            <button type="button" onClick={onPin} title={reply.pinned ? 'Sent to everyone' : 'Send this one to everyone'} aria-pressed={reply.pinned}
              className={cx('grid h-7 w-7 place-items-center rounded-md', reply.pinned ? 'text-amber-500' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500')}><Star className="h-3.5 w-3.5" fill={reply.pinned ? 'currentColor' : 'none'} /></button>
          )}
          <Switch on={reply.is_active} onChange={(v) => onChange({ is_active: v })} label={reply.is_active ? 'Version in use' : 'Version paused'} />
          <button type="button" onClick={onRemove} className="grid h-7 w-7 place-items-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove this version"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="space-y-4 p-3 pt-3">
        {reply.format === 'card' && (
          <div className="grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)]">
            <span className="flex aspect-square w-[88px] items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {reply.image_url ? <img src={reply.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-slate-300" />}
            </span>
            <div className="space-y-2.5">
              <Field label="Title" count={`${(reply.title || '').length}/80`}>
                <input value={reply.title || ''} maxLength={80} onChange={(e) => onChange({ title: e.target.value })} placeholder="Manali Snow Escape · 4D/3N" className={input} />
              </Field>
              <Field label="Image link" hint="https://…">
                <input value={reply.image_url || ''} onChange={(e) => onChange({ image_url: e.target.value })} placeholder="https://…/photo.jpg" className={input} />
              </Field>
            </div>
          </div>
        )}

        {reply.format === 'card' && !privateReply && (
          <Field label="Text before the card" hint="optional" count={`${(reply.options?.before_text || '').length}/1000`}>
            <textarea value={reply.options?.before_text || ''} rows={1} maxLength={1000} onChange={(e) => onChange({ options: { ...reply.options, before_text: e.target.value } })}
              placeholder="{greeting} {first_name}! Here’s what you asked for 👇" className={cx(input, 'resize-none leading-relaxed [field-sizing:content]')} />
          </Field>
        )}

        <Field label={reply.format === 'card' ? 'Description' : reply.format === 'trips' ? 'Text before the cards' : isComment ? 'Reply' : privateReply ? 'Message (sent privately)' : 'Message'}
          hint={reply.format === 'trips' ? 'optional' : undefined}
          count={`${reply.text.length}/${limit}`}
          action={<VarMenu onPick={insert} />}>
          <textarea value={reply.text} maxLength={limit} rows={reply.format === 'card' ? 2 : 3} onChange={(e) => onChange({ text: e.target.value })}
            placeholder={isComment ? 'Thanks {username}! Sent you the details in DM 📩' : reply.format === 'trips' ? 'Here’s our {trip} {first_name} 👇' : reply.format === 'card' ? 'From ₹7,999 · Every weekend' : 'Hey {first_name}! Thanks for reaching out 🙌'}
            className={cx(input, 'min-h-[76px] resize-none leading-relaxed [field-sizing:content]')} />
        </Field>

        {reply.format === 'trips' && <TripOptionsEditor reply={reply} siteUrl={siteUrl} liveTrips={liveTrips} onChange={onChange} />}

        {!isComment && reply.format !== 'trips' && buttonsOpen && (
          <ButtonsEditor buttons={reply.buttons} presets={presets} disabled={reply.quick_replies.length > 0}
            onChange={(b) => { onChange({ buttons: b }); if (!b.length) setShowButtons(false); }} />
        )}

        {!isComment && reply.format === 'text' && !privateReply && quickOpen && (
          <QuickReplies value={reply.quick_replies} disabled={reply.buttons.length > 0} onChange={(q) => { onChange({ quick_replies: q }); if (!q.length) setShowQuick(false); }} />
        )}

        {!isComment && reply.format !== 'text' && !privateReply && <FollowUp reply={reply} onChange={onChange} />}

        {/* Add-ons, folded until needed */}
        {!isComment && reply.format === 'text' && (!buttonsOpen || (!quickOpen && !privateReply)) && (
          <div className="flex flex-wrap gap-1.5">
            {!buttonsOpen && <AddChip disabled={reply.quick_replies.length > 0} onClick={() => setShowButtons(true)} icon={<Link2 className="h-3 w-3" />}>Link buttons</AddChip>}
            {!quickOpen && !privateReply && <AddChip disabled={reply.buttons.length > 0} onClick={() => setShowQuick(true)} icon={<MousePointerClick className="h-3 w-3" />}>Quick replies</AddChip>}
          </div>
        )}

        {!isComment && reply.format !== 'text' && privateReply && (
          <p className="text-[11px] text-slate-500">Comment DMs can only be one message, so only the {reply.format === 'trips' ? 'cards' : 'card'} are sent.</p>
        )}
      </div>
    </div>
  );
}

function AddChip({ onClick, icon, disabled, children }: { onClick: () => void; icon: React.ReactNode; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={disabled ? 'Instagram allows buttons or quick replies on a message, not both' : undefined}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-slate-300 px-2.5 text-[11px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40">
      <Plus className="h-3 w-3" />{icon}{children}
    </button>
  );
}

const inputBase = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100';
const input = `${inputBase} w-full`;

function Field({ label, hint, count, action, children }: { label: string; hint?: string; count?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
        <span className="ml-auto flex items-center gap-2">{action}{count && <span className="text-[11px] tabular-nums text-slate-400">{count}</span>}</span>
      </div>
      {children}
    </div>
  );
}

function ButtonsEditor({ buttons, presets, disabled, onChange }: { buttons: { title: string; url: string }[]; presets: { title: string; url: string }[]; disabled: boolean; onChange: (b: { title: string; url: string }[]) => void }) {
  const upd = (i: number, p: Partial<{ title: string; url: string }>) => onChange(buttons.map((b, j) => (j === i ? { ...b, ...p } : b)));
  return (
    <div className={cx(disabled && 'pointer-events-none opacity-50')}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-slate-700"><Link2 className="h-3 w-3" />Buttons</span>
        <span className="text-[11px] text-slate-400">{disabled ? 'Remove quick replies to use buttons' : 'up to 3, open a link'}</span>
      </div>
      <div className="space-y-1.5">
        {buttons.map((b, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_32px] gap-1.5">
            <input value={b.title} maxLength={20} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Label" className={cx(inputBase, 'h-9 w-full py-0')} />
            <input value={b.url} onChange={(e) => upd(i, { url: e.target.value })} placeholder="https://…" className={cx(inputBase, 'h-9 w-full py-0 font-mono text-xs', b.url && !/^https:\/\/\S+\.\S+/.test(b.url) && 'border-rose-300')} />
            <button type="button" onClick={() => onChange(buttons.filter((_, j) => j !== i))} className="grid h-9 w-8 place-items-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-rose-600" aria-label="Remove button"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      {buttons.length < 3 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onChange([...buttons, { title: '', url: 'https://' }])} className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 text-[11px] font-medium text-slate-600 hover:border-slate-400"><Plus className="h-3 w-3" />Custom</button>
          {presets.filter((p) => !buttons.some((b) => b.title === p.title)).map((p) => (
            <button key={p.title} type="button" onClick={() => onChange([...buttons, p])} className="inline-flex h-6 items-center gap-1 rounded-md bg-slate-100 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-200"><Plus className="h-3 w-3" />{p.title}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickReplies({ value, disabled, onChange }: { value: string[]; disabled: boolean; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim().slice(0, 20); if (t && value.length < 13 && !value.includes(t)) onChange([...value, t]); setDraft(''); };
  return (
    <div className={cx(disabled && 'pointer-events-none opacity-50')}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-700">Quick replies</span>
        <span className="text-[11px] text-slate-400">{disabled ? 'Remove buttons to use quick replies' : 'tappable answers — pair them with keyword rules'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((q) => (
          <span key={q} className="inline-flex items-center gap-1 rounded-full border border-[#0095f6] px-2.5 py-1 text-[11px] font-medium text-[#0095f6]">
            {q}<button type="button" onClick={() => onChange(value.filter((x) => x !== q))} aria-label={`Remove ${q}`}><X className="h-3 w-3" /></button>
          </span>
        ))}
        {value.length < 13 && (
          <input value={draft} maxLength={20} onChange={(e) => setDraft(e.target.value)} onBlur={add}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder="Type and press Enter" className="h-7 w-44 rounded-full border border-dashed border-slate-300 px-3 text-[11px] focus:border-[#0095f6] focus:outline-none" />
        )}
      </div>
    </div>
  );
}


const VARS = [
  { v: '{first_name}', l: 'First name', ex: 'Riya' },
  { v: '{name}', l: 'Full name', ex: 'Riya Sharma' },
  { v: '{username}', l: 'Handle', ex: '@traveller.riya' },
  { v: '{greeting}', l: 'Greeting', ex: 'Good evening' },
  { v: '{day}', l: 'Weekday', ex: 'Saturday' },
  { v: '{trip}', l: 'Trip asked about', ex: 'Manali Kasol Escape · else “trips”' },
  { v: '{Hi|Hey|Hello}', l: 'Random pick', ex: 'Hi / Hey / Hello' },
];

/** Insert a variable; names fall back to the @handle when Instagram has no name. */
function VarMenu({ onPick }: { onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"><Braces className="h-3 w-3" />Insert</button>
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="absolute right-0 top-6 z-20 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {VARS.map((x) => (
              <button key={x.v} type="button" onClick={() => { onPick(x.v); setOpen(false); }} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-50">
                <span className="text-xs font-medium text-slate-800">{x.l}</span>
                <span className="truncate text-[11px] text-slate-400">{x.ex}</span>
              </button>
            ))}
            <span className="block border-t border-slate-100 px-2.5 py-1.5 text-[10px] leading-snug text-slate-400">Names fall back to the @handle if Instagram doesn’t share them.</span>
          </span>
        </>
      )}
    </span>
  );
}

const FIELD_OPTS: { k: TripField; l: string }[] = [
  { k: 'price', l: 'Price' }, { k: 'old_price', l: 'Was-price' }, { k: 'duration', l: 'Duration' },
  { k: 'place', l: 'Place' }, { k: 'date', l: 'Start date' }, { k: 'description', l: 'Short description' },
];

/** Which trips go out, how they're ordered, what each card shows, and its buttons. */
function TripOptionsEditor({ reply, siteUrl, liveTrips, onChange }: { reply: RuleReply; siteUrl: string; liveTrips?: LiveTrip[] | null; onChange: (p: Partial<RuleReply>) => void }) {
  const o = reply.options || {};
  const set = (p: Partial<NonNullable<RuleReply['options']>>) => onChange({ options: { ...o, ...p } });
  const pick = o.trip_pick || 'auto';
  const fields = o.trip_fields?.length ? o.trip_fields : DEFAULT_FIELDS;
  const extra = o.trip_extra_button || null;

  return (
    <div className="divide-y divide-slate-100 rounded-lg bg-slate-50/80 ring-1 ring-slate-200/70">
      <SubRow label="Trips">
        <Segmented size="xs" value={pick} onChange={(v) => set({ trip_pick: v as any })}
          options={[{ k: 'auto', l: 'Upcoming' }, { k: 'match', l: 'The one they ask about' }, { k: 'selected', l: 'Pick' }]} />
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          {pick === 'auto' && 'Your bookable trips, in the order below.'}
          {pick === 'match' && 'Only trips named in the message — “kasol” sends Kasol. For comment DMs the post caption counts too.'}
          {pick === 'selected' && 'Exactly these, in this order — even if booking is closed.'}
        </p>
        {pick === 'match' && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span>If none is named, send</span>
            <MiniSelect value={o.trip_fallback || 'auto'} onChange={(v) => set({ trip_fallback: v as any })} options={[['auto', 'upcoming trips'], ['text', 'only the text']]} />
          </div>
        )}
        {pick === 'selected' && <div className="mt-2"><TripPicker trips={liveTrips} value={o.trip_ids || []} onChange={(ids) => set({ trip_ids: ids })} /></div>}
      </SubRow>

      {pick !== 'selected' && (
        <SubRow label="Show">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <MiniSelect value={String(o.trips_limit || 5)} onChange={(v) => set({ trips_limit: Number(v) })} options={[1, 2, 3, 4, 5, 6, 8, 10].map((n) => [String(n), n === 1 ? 'only 1 trip' : `up to ${n} trips`] as [string, string])} />
            <span>sorted by</span>
            <MiniSelect value={o.trip_sort || 'featured'} onChange={(v) => set({ trip_sort: v as any })} options={[['featured', 'featured first'], ['cheapest', 'lowest price'], ['newest', 'newest added'], ['soonest', 'soonest date']]} />
          </div>
        </SubRow>
      )}

      <SubRow label="Card line" hint="max 80 chars">
        <div className="flex flex-wrap gap-1">
          {FIELD_OPTS.map((f) => {
            const on = fields.includes(f.k);
            return (
              <button key={f.k} type="button" aria-pressed={on} onClick={() => set({ trip_fields: on ? fields.filter((x) => x !== f.k) : [...fields, f.k] })}
                className={cx('inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors', on ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300')}>
                {on && <Check className="h-3 w-3" />}{f.l}
              </button>
            );
          })}
        </div>
      </SubRow>

      <SubRow label="Buttons">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input value={o.trip_button ?? 'View trip'} maxLength={20} onChange={(e) => set({ trip_button: e.target.value })} className={cx(inputBase, 'h-8 w-40 py-0 text-xs')} aria-label="Main button label" />
            <span className="text-[11px] text-slate-400">opens the trip page</span>
          </div>
          {extra ? (
            <div className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)_32px] gap-1.5">
              <input value={extra.title} maxLength={20} onChange={(e) => set({ trip_extra_button: { ...extra, title: e.target.value } })} placeholder="Label" className={cx(inputBase, 'h-8 w-full py-0 text-xs')} />
              <input value={extra.url} onChange={(e) => set({ trip_extra_button: { ...extra, url: e.target.value } })} placeholder="https://…" className={cx(inputBase, 'h-8 w-full py-0 font-mono text-[11px]', extra.url && !/^https:\/\/\S+\.\S+/.test(extra.url) && 'border-rose-300')} />
              <button type="button" onClick={() => set({ trip_extra_button: null })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white hover:text-rose-600" aria-label="Remove second button"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Second button:</span>
              {[
                { title: 'All trips', url: siteUrl ? `${siteUrl}/trips` : 'https://' },
                { title: 'Our website', url: siteUrl || 'https://' },
                { title: 'WhatsApp us', url: 'https://wa.me/91' },
                { title: '', url: 'https://' },
              ].map((b) => (
                <button key={b.title || 'custom'} type="button" onClick={() => set({ trip_extra_button: b })}
                  className="inline-flex h-6 items-center gap-1 rounded-md bg-white px-2 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 hover:text-slate-900 hover:ring-slate-300">
                  <Plus className="h-3 w-3" />{b.title || 'Custom'}
                </button>
              ))}
            </div>
          )}
        </div>
      </SubRow>
    </div>
  );
}

function SubRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-1 px-3 py-2.5 sm:grid-cols-[84px_minmax(0,1fr)]">
      <div className="pt-1"><p className="text-xs font-medium text-slate-700">{label}</p>{hint && <p className="text-[10px] text-slate-400">{hint}</p>}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function TripPicker({ trips, value, onChange }: { trips?: LiveTrip[] | null; value: string[]; onChange: (ids: string[]) => void }) {
  if (!trips) return <p className="text-[11px] text-slate-400">Loading trips…</p>;
  if (!trips.length) return <p className="text-[11px] text-slate-500">No live trips found.</p>;
  return (
    <div className="gk-scroll-subtle max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
      {trips.map((t) => {
        const n = value.indexOf(t.id);
        const on = n >= 0;
        return (
          <button key={t.id} type="button" onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id].slice(0, 10))}
            className={cx('flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors', on ? 'bg-slate-100' : 'hover:bg-slate-50')}>
            <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', on ? 'bg-slate-900 text-white' : 'border border-slate-300 text-transparent')}>{on ? n + 1 : '·'}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {t.image ? <img src={t.image} alt="" className="h-8 w-8 shrink-0 rounded object-cover" /> : <span className="h-8 w-8 shrink-0 rounded bg-slate-100" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-slate-900">{t.title}</span>
              <span className="block truncate text-[11px] text-slate-500">{[t.place, t.price ? `₹${t.price.toLocaleString('en-IN')}` : ''].filter(Boolean).join(' · ')}</span>
            </span>
            {!t.bookable && <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">booking closed</span>}
            {t.featured && t.bookable && <span className="shrink-0 rounded bg-pink-50 px-1.5 py-0.5 text-[10px] font-medium text-[#a3195b]">featured</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A message after the card(s), with optional quick replies — e.g. “Which date suits you?” + chips. */
function FollowUp({ reply, onChange }: { reply: RuleReply; onChange: (p: Partial<RuleReply>) => void }) {
  const o = reply.options || {};
  const set = (p: Partial<NonNullable<RuleReply['options']>>) => onChange({ options: { ...o, ...p } });
  const on = o.after_text != null;
  if (!on) {
    return (
      <button type="button" onClick={() => set({ after_text: '' })} className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-400">
        <Plus className="h-3 w-3" />Add a message after the {reply.format === 'trips' ? 'cards' : 'card'}
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <Field label={`Message after the ${reply.format === 'trips' ? 'cards' : 'card'}`} count={`${(o.after_text || '').length}/1000`}
        action={<button type="button" onClick={() => set({ after_text: undefined, after_quick: [] })} className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100">Remove</button>}>
        <textarea value={o.after_text || ''} rows={2} maxLength={1000} onChange={(e) => set({ after_text: e.target.value })}
          placeholder="Which month are you planning for {first_name}? 🗓️" className={cx(input, 'resize-none leading-relaxed')} />
      </Field>
      <QuickReplies value={o.after_quick || []} disabled={false} onChange={(q) => set({ after_quick: q })} />
    </div>
  );
}
