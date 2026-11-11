'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  X, Hash, MessagesSquare, Clock, Plus, Trash2, Star, Type, CreditCard, Map, Link2, MousePointerClick, Send, Check, Image as ImageIcon, AtSign, MessageCircle,
} from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import ReplyPreview from './ReplyPreview';
import { Button, Segmented, Switch, IconChip, cx } from './shared';
import { mediaThumb, type IgMediaItem, type ReplyRule, type RuleReply, type RulesData, type TripCardPreview } from './types';

const HOURS = Array.from({ length: 24 }, (_, h) => ({ v: h, l: `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}` }));
const COOLDOWNS = [
  { v: 0, l: 'Every time they match' }, { v: 1, l: 'Once an hour' }, { v: 12, l: 'Once every 12 hours' },
  { v: 24, l: 'Once a day' }, { v: 168, l: 'Once a week' }, { v: 720, l: 'Once a month' },
];

export const blankReply = (kind: 'dm' | 'comment', pinned = false): RuleReply => ({
  kind, format: 'text', text: '', title: null, image_url: null, buttons: [], quick_replies: [], options: {}, is_active: true, pinned,
});

export const blankRule = (channel: 'dm' | 'comment'): ReplyRule => ({
  channel, name: '', trigger: 'keywords', keywords: [], match_type: 'contains', media_ids: [], reply_mode: 'random',
  cooldown_hours: channel === 'dm' ? 0 : 0, send_dm: false, active_from: null, active_to: null, is_active: true,
  replies: [blankReply(channel === 'dm' ? 'dm' : 'comment', true)],
});

export default function RuleEditor({ initial, media, data, profile, onClose, onSaved }: {
  initial: ReplyRule; media: IgMediaItem[]; data: RulesData; profile?: { username?: string; picture?: string | null };
  onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useAdminLive();
  const [rule, setRule] = useState<ReplyRule>(() => JSON.parse(JSON.stringify(initial)));
  const [focus, setFocus] = useState<{ kind: 'dm' | 'comment'; i: number }>({ kind: initial.channel === 'dm' ? 'dm' : 'comment', i: 0 });
  const [saving, setSaving] = useState(false);
  const [trips, setTrips] = useState<TripCardPreview[] | null>(null);
  const [testTo, setTestTo] = useState(data.testTargets[0]?.user_id || '');
  const [testing, setTesting] = useState(false);
  const isDm = rule.channel === 'dm';

  const set = (p: Partial<ReplyRule>) => setRule((r) => ({ ...r, ...p }));
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

  // Live trip cards for the preview.
  const tripLimit = Math.max(0, ...rule.replies.filter((r) => r.format === 'trips').map((r) => r.options?.trips_limit || 5));
  useEffect(() => {
    if (!tripLimit) return;
    fetch('/api/admin/instagram/rules/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewTrips: tripLimit }) })
      .then((r) => r.json()).then((j) => setTrips(j.cards || [])).catch(() => setTrips([]));
  }, [tripLimit]);

  const dmReplies = list('dm');
  const pubReplies = list('comment');
  const previewDm = focus.kind === 'dm' ? rule.replies[focus.i] : dmReplies[0]?.r;
  const previewPub = focus.kind === 'comment' ? rule.replies[focus.i] : pubReplies[0]?.r;
  const sample = rule.trigger === 'keywords' && rule.keywords[0] ? (isDm ? `Hi, ${rule.keywords[0]}?` : `${rule.keywords[0]}`) : isDm ? 'Hi! Is the Manali trip available?' : 'Details please 🙌';

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

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate-900/40 backdrop-blur-[2px] sm:p-4" onClick={() => !saving && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Edit rule" onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-6xl flex-col overflow-hidden bg-slate-50 shadow-2xl animate-slide-up sm:rounded-3xl">
        {/* Top bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <IconChip icon={isDm ? <MessagesSquare /> : <MessageCircle />} gradient={isDm} tone="orange" />
          <input value={rule.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} autoFocus={!rule.id}
            placeholder={isDm ? 'Rule name, e.g. Price enquiry' : 'Rule name, e.g. “Details” comments'}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none" />
          <span className="hidden text-xs text-slate-500 sm:inline">{isDm ? 'Messages' : 'Comments'} rule</span>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
          {/* Form */}
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            {/* 1. WHEN */}
            <Step n={1} title="When should it reply?">
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice on={rule.trigger === 'keywords'} onClick={() => set({ trigger: 'keywords' })} icon={<Hash />} title="Keywords" desc={isDm ? 'Message contains certain words' : 'Comment contains certain words'} />
                <Choice on={rule.trigger === 'any'} onClick={() => set({ trigger: 'any' })} icon={<MessagesSquare />} title={isDm ? 'Any other message' : 'Any other comment'} desc="When no keyword rule matches" />
              </div>
              {rule.trigger === 'keywords' && (
                <div className="mt-3 space-y-2">
                  <KeywordInput value={rule.keywords} onChange={(k) => set({ keywords: k })} />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Segmented size="xs" value={rule.match_type} onChange={(v) => set({ match_type: v as any })} options={[{ k: 'contains', l: 'Contains the word' }, { k: 'exact', l: 'Is exactly' }]} />
                    <span>Not case-sensitive. Quick-reply taps count as messages too.</span>
                  </div>
                </div>
              )}

              {!isDm && (
                <div className="mt-4">
                  <p className="mb-2 text-[13px] font-medium text-slate-900">On which posts?</p>
                  <Segmented value={rule.media_ids.length ? 'some' : 'all'} onChange={(v) => set({ media_ids: v === 'all' ? [] : media.slice(0, 1).map((m) => m.id) })}
                    options={[{ k: 'all', l: 'All watched posts' }, { k: 'some', l: 'Only selected posts' }]} />
                  {rule.media_ids.length > 0 && (
                    <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-8">
                      {media.slice(0, 24).map((m) => {
                        const on = rule.media_ids.includes(m.id);
                        return (
                          <button key={m.id} type="button" onClick={() => set({ media_ids: on ? rule.media_ids.filter((x) => x !== m.id) : [...rule.media_ids, m.id] })}
                            className={cx('relative aspect-[3/4] overflow-hidden rounded-lg ring-offset-2 transition', on ? 'ring-2 ring-pink-500' : 'opacity-60 hover:opacity-100')}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={mediaThumb(m)} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-white"><Check className="h-3 w-3" /></span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-900"><Clock className="h-3.5 w-3.5 text-slate-400" />Active</p>
                <Segmented value={rule.active_from == null ? 'always' : 'hours'} onChange={(v) => set(v === 'always' ? { active_from: null, active_to: null } : { active_from: 21, active_to: 9 })}
                  options={[{ k: 'always', l: 'All day' }, { k: 'hours', l: 'Only between' }]} />
                {rule.active_from != null && (
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <HourSelect value={rule.active_from} onChange={(v) => set({ active_from: v })} /> and <HourSelect value={rule.active_to ?? 9} onChange={(v) => set({ active_to: v })} /> IST
                  </span>
                )}
              </div>
            </Step>

            {/* 2. REPLY */}
            <Step n={2} title="What should it send?"
              right={<Segmented size="xs" value={rule.reply_mode} onChange={(v) => set({ reply_mode: v as any })} options={[{ k: 'random', l: 'Random reply' }, { k: 'fixed', l: 'Same for everyone' }]} />}>
              {!isDm && (
                <>
                  <SubHead icon={<MessageCircle className="h-3.5 w-3.5" />} title="Public reply under the comment" />
                  <div className="space-y-2">
                    {pubReplies.map(({ r, i }) => (
                      <ReplyCard key={i} reply={r} kind="comment" mode={rule.reply_mode} siteUrl={data.siteUrl} selected={focus.kind === 'comment' && focus.i === i}
                        onSelect={() => setFocus({ kind: 'comment', i })} onChange={(p) => updateReply(i, p)} onRemove={() => removeReply(i)} onPin={() => pin(i)} />
                    ))}
                    <AddButton onClick={() => addReply('comment')}>Add public reply</AddButton>
                  </div>
                  <div className="my-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">Also send them a DM</p>
                      <p className="text-xs text-slate-500">One private message per comment — great for sending details and links.</p>
                    </div>
                    <Switch on={rule.send_dm} onChange={(v) => { set({ send_dm: v }); if (v && !dmReplies.length) addReply('dm'); }} label="Also send a DM" />
                  </div>
                </>
              )}

              {(isDm || rule.send_dm) && (
                <>
                  {!isDm && <SubHead icon={<Send className="h-3.5 w-3.5" />} title="Direct message" />}
                  <div className="space-y-2">
                    {dmReplies.map(({ r, i }) => (
                      <ReplyCard key={i} reply={r} kind="dm" mode={rule.reply_mode} siteUrl={data.siteUrl} selected={focus.kind === 'dm' && focus.i === i}
                        onSelect={() => setFocus({ kind: 'dm', i })} onChange={(p) => updateReply(i, p)} onRemove={() => removeReply(i)} onPin={() => pin(i)} privateReply={!isDm} />
                    ))}
                    <AddButton onClick={() => addReply('dm')}>{dmReplies.length ? 'Add another version' : 'Add message'}</AddButton>
                  </div>
                </>
              )}
              {rule.reply_mode === 'random' && rule.replies.length > 1 && <p className="mt-3 text-xs text-slate-500">Each person gets one of these at random — never the same one twice in a row.</p>}
            </Step>

            {/* 3. LIMITS */}
            {isDm && (
              <Step n={3} title="How often per person?">
                <div className="flex flex-wrap gap-1.5">
                  {COOLDOWNS.map((c) => (
                    <button key={c.v} type="button" onClick={() => set({ cooldown_hours: c.v })}
                      className={cx('rounded-full border px-3 py-1.5 text-xs font-medium transition', rule.cooldown_hours === c.v ? 'border-transparent bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
                      {c.l}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">{rule.trigger === 'keywords' ? 'Keyword answers usually work best every time.' : 'A welcome message usually works best once a day.'}</p>
              </Step>
            )}
          </div>

          {/* Preview */}
          <div className="border-t border-slate-200 bg-white p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Live preview</p>
            <ReplyPreview channel={rule.channel} incoming={sample} reply={isDm || rule.send_dm ? previewDm || null : null} publicReply={!isDm ? previewPub || null : undefined} trips={trips} profile={profile} />
            {(isDm || rule.send_dm) && previewDm && (
              <div className="mt-4 rounded-2xl border border-slate-200 p-3">
                <p className="text-[13px] font-medium text-slate-900">Send a test</p>
                {data.testTargets.length === 0 ? (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">Message your business account from another Instagram account, wait a minute for the sync, then send yourself this reply to see the real thing.</p>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <select value={testTo} onChange={(e) => setTestTo(e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                      {data.testTargets.map((t) => <option key={t.user_id} value={t.user_id}>@{t.username || t.user_id}</option>)}
                    </select>
                    <Button size="sm" variant="primary" onClick={sendTest} loading={testing} icon={<Send className="h-3.5 w-3.5" />}>Send</Button>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-400">Buttons and cards show in the Instagram app (not on the web).</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer: destructive left, commit right */}
        <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-5 py-3">
          {rule.id && <Button variant="danger" onClick={remove} disabled={saving} icon={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>}
          <label className="ml-1 flex items-center gap-2 text-xs text-slate-600"><Switch on={rule.is_active} onChange={(v) => set({ is_active: v })} label="Rule on" />{rule.is_active ? 'Rule on' : 'Rule off'}</label>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="gradient" onClick={save} loading={saving} icon={<Check className="h-3.5 w-3.5" />}>{rule.id ? 'Save rule' : 'Create rule'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── pieces ───────── */

function Step({ n, title, right, children }: { n: number; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">{n}</span>
        <h3 className="flex-1 text-sm font-semibold text-slate-900">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function SubHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{title}</p>;
}

function Choice({ on, onClick, icon, title, desc }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('flex items-start gap-3 rounded-xl border p-3 text-left transition', on ? 'border-pink-300 bg-pink-50/40 ring-4 ring-pink-50' : 'border-slate-200 hover:border-slate-300')}>
      <span className={cx('mt-0.5 [&>svg]:h-4 [&>svg]:w-4', on ? 'text-pink-600' : 'text-slate-400')}>{icon}</span>
      <span><span className="block text-[13px] font-semibold text-slate-900">{title}</span><span className="block text-xs text-slate-500">{desc}</span></span>
    </button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-600 hover:border-pink-300 hover:bg-pink-50/30 hover:text-pink-700">
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

function KeywordInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const words = raw.split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (words.length) onChange(Array.from(new Set([...value, ...words])).slice(0, 30));
    setDraft('');
  };
  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 focus-within:border-pink-300 focus-within:ring-4 focus-within:ring-pink-50">
      {value.map((k) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-50 to-pink-50 px-2.5 py-1 text-xs font-medium text-pink-700 ring-1 ring-inset ring-pink-200">
          {k}<button type="button" onClick={() => onChange(value.filter((x) => x !== k))} className="text-pink-400 hover:text-pink-700" aria-label={`Remove ${k}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft && add(draft)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); } if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
        placeholder={value.length ? 'Add more…' : 'price, cost, details, manali…  (press Enter)'} className="min-w-[160px] flex-1 bg-transparent px-1 text-[13px] focus:outline-none" />
    </div>
  );
}

const FORMATS = [
  { k: 'text', l: 'Text', icon: Type, desc: 'Message with optional link buttons or quick replies' },
  { k: 'card', l: 'Card', icon: CreditCard, desc: 'Image, title and up to 3 buttons' },
  { k: 'trips', l: 'Trip cards', icon: Map, desc: 'Your live upcoming trips, swipeable' },
] as const;

function ReplyCard({ reply, kind, mode, siteUrl, selected, onSelect, onChange, onRemove, onPin, privateReply }: {
  reply: RuleReply; kind: 'dm' | 'comment'; mode: 'random' | 'fixed'; siteUrl: string; selected: boolean; privateReply?: boolean;
  onSelect: () => void; onChange: (p: Partial<RuleReply>) => void; onRemove: () => void; onPin: () => void;
}) {
  const isComment = kind === 'comment';
  const limit = isComment ? 300 : reply.format === 'card' ? 80 : reply.buttons.length ? 640 : 1000;
  const insertName = () => onChange({ text: `${reply.text}${reply.text && !reply.text.endsWith(' ') ? ' ' : ''}{username}` });
  const presets = useMemo(() => [
    { title: 'Visit website', url: siteUrl || 'https://' },
    { title: 'View all trips', url: siteUrl ? `${siteUrl}/trips` : 'https://' },
    { title: 'Chat on WhatsApp', url: 'https://wa.me/91' },
  ], [siteUrl]);

  return (
    <div onClick={onSelect} className={cx('rounded-xl border bg-white transition', selected ? 'border-pink-300 ring-4 ring-pink-50' : 'border-slate-200 hover:border-slate-300', !reply.is_active && 'opacity-60')}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        {!isComment ? (
          <div className="flex gap-1">
            {FORMATS.map((f) => (
              <button key={f.k} type="button" title={f.desc} onClick={() => onChange({ format: f.k, ...(f.k !== 'text' ? { quick_replies: [] } : {}), ...(f.k === 'trips' ? { buttons: [], options: { trips_limit: reply.options?.trips_limit || 5, trip_button: reply.options?.trip_button || 'View trip' } } : {}) })}
                className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition', reply.format === f.k ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')}>
                <f.icon className="h-3 w-3" />{f.l}
              </button>
            ))}
          </div>
        ) : <span className="text-[11px] font-semibold text-slate-500">Public reply</span>}
        <div className="ml-auto flex items-center gap-1">
          {mode === 'fixed' && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onPin(); }} title={reply.pinned ? 'This one is sent to everyone' : 'Send this one to everyone'}
              className={cx('rounded-md p-1', reply.pinned ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500')}><Star className="h-3.5 w-3.5" fill={reply.pinned ? 'currentColor' : 'none'} /></button>
          )}
          <label className="flex items-center gap-1 px-1 text-[11px] text-slate-500" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={reply.is_active} onChange={(e) => onChange({ is_active: e.target.checked })} className="h-3.5 w-3.5 accent-[#0095f6]" />Use
          </label>
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="rounded-md p-1 text-slate-300 hover:text-rose-600" aria-label="Remove reply"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {reply.format === 'card' && (
          <>
            <Field label="Image link" hint="https://… (a trip photo works well)">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {reply.image_url ? <img src={reply.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-slate-300" />}
                </span>
                <input value={reply.image_url || ''} onChange={(e) => onChange({ image_url: e.target.value })} placeholder="https://…/photo.jpg" className={input} />
              </div>
            </Field>
            <Field label="Title" count={`${(reply.title || '').length}/80`}>
              <input value={reply.title || ''} maxLength={80} onChange={(e) => onChange({ title: e.target.value })} placeholder="Manali Snow Escape · 4D/3N" className={input} />
            </Field>
          </>
        )}

        <Field label={reply.format === 'card' ? 'Description' : reply.format === 'trips' ? 'Intro message (optional)' : isComment ? 'Reply' : privateReply ? 'Message (sent privately)' : 'Message'}
          count={`${reply.text.length}/${limit}`}
          action={<button type="button" onClick={insertName} className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-pink-600 hover:bg-pink-50"><AtSign className="h-3 w-3" />Add their name</button>}>
          <textarea value={reply.text} maxLength={limit} rows={reply.format === 'card' ? 2 : 3} onChange={(e) => onChange({ text: e.target.value })}
            placeholder={isComment ? 'Thanks {username}! Sent you the details in DM 📩' : reply.format === 'trips' ? 'Here are our upcoming trips 👇' : reply.format === 'card' ? 'From ₹7,999 · Every weekend' : 'Hey {username}! Thanks for reaching out 🙌'}
            className={cx(input, 'resize-none leading-relaxed')} />
        </Field>

        {reply.format === 'trips' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="How many trips">
              <select value={reply.options?.trips_limit || 5} onChange={(e) => onChange({ options: { ...reply.options, trips_limit: Number(e.target.value) } })} className={input}>
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'trip' : 'trips'}</option>)}
              </select>
            </Field>
            <Field label="Button label" count={`${(reply.options?.trip_button || '').length}/20`}>
              <input value={reply.options?.trip_button ?? 'View trip'} maxLength={20} onChange={(e) => onChange({ options: { ...reply.options, trip_button: e.target.value } })} className={input} />
            </Field>
            <p className="col-span-2 text-[11px] text-slate-500">Featured trips first. Each card shows the cover photo, price and duration, and opens the trip page.</p>
          </div>
        )}

        {!isComment && reply.format !== 'trips' && (
          <ButtonsEditor buttons={reply.buttons} presets={presets} disabled={reply.quick_replies.length > 0}
            onChange={(b) => onChange({ buttons: b })} />
        )}

        {!isComment && reply.format === 'text' && !privateReply && (
          <QuickReplies value={reply.quick_replies} disabled={reply.buttons.length > 0} onChange={(q) => onChange({ quick_replies: q })} />
        )}
      </div>
    </div>
  );
}

const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-pink-300 focus:outline-none focus:ring-4 focus:ring-pink-50';

function Field({ label, hint, count, action, children }: { label: string; hint?: string; count?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-700">{label}</span>
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
          <div key={i} className="flex gap-1.5">
            <input value={b.title} maxLength={20} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Label" className={cx(input, 'w-36 shrink-0')} />
            <input value={b.url} onChange={(e) => upd(i, { url: e.target.value })} placeholder="https://…" className={cx(input, 'min-w-0 flex-1 font-mono text-xs', b.url && !/^https:\/\/\S+\.\S+/.test(b.url) && 'border-rose-300')} />
            <button type="button" onClick={() => onChange(buttons.filter((_, j) => j !== i))} className="shrink-0 rounded-lg px-2 text-slate-300 hover:bg-slate-100 hover:text-rose-600" aria-label="Remove button"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      {buttons.length < 3 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onChange([...buttons, { title: '', url: 'https://' }])} className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-400"><Plus className="h-3 w-3" />Button</button>
          {presets.filter((p) => !buttons.some((b) => b.title === p.title)).map((p) => (
            <button key={p.title} type="button" onClick={() => onChange([...buttons, p])} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"><MousePointerClick className="h-3 w-3" />{p.title}</button>
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
            placeholder="e.g. Prices, Next trips…" className="h-7 w-40 rounded-full border border-dashed border-slate-300 px-3 text-[11px] focus:border-[#0095f6] focus:outline-none" />
        )}
      </div>
    </div>
  );
}

