/**
 * Auto-reply rule matching — pure code (no server imports), shared by the
 * engine, the rules API and the admin's "Test a message" simulator, so what the
 * simulator says is exactly what the engine does.
 *
 * A rule fires when ALL of these hold:
 *   channel · switched on · trigger (keywords / any / media / story) · exclusions
 *   · posts (comments) · hours · days · campaign dates · who (new/returning,
 *   follows, follower count) · comment is not just tags/emoji (if asked)
 * Order: specific triggers (keywords, media, story) top to bottom first, then
 * catch-alls (post-specific before general). The first match wins — including a
 * "stay silent" rule, which swallows the message so nothing is sent.
 *
 * Send-time checks that need the database (wait N minutes, once per person,
 * daily cap, muted person, team recently replied) live in the engine.
 */

export type Trigger = 'any' | 'keywords' | 'media' | 'story';
export type MatchType = 'contains' | 'exact' | 'starts';
export type MessageKind = 'text' | 'media' | 'story';

export interface RuleConditions {
  /** keywords: any one word is enough, or every word must appear */
  keyword_logic?: 'any' | 'all';
  /** never fire when the message contains one of these */
  exclude?: string[];
  /** DMs: everyone, people writing for the first time, or people who wrote before */
  audience?: 'everyone' | 'new' | 'returning';
  follows?: 'any' | 'followers' | 'non_followers';
  /** only people with at least this many followers (0 = anyone) */
  min_followers?: number;
  /** IST weekdays, 0 = Sunday … 6 = Saturday; empty = every day */
  days?: number[];
  /** campaign window, YYYY-MM-DD in IST, inclusive */
  starts_on?: string | null;
  ends_on?: string | null;
  /** wait this long before replying; skipped if the team answers first */
  delay_minutes?: number;
  /** at most this many sends per IST day for this rule (0 = no cap) */
  daily_limit?: number;
  /** after this rule fires, no auto replies to this person for N hours */
  mute_hours?: number;
  /** comments: skip comments that only tag people or are only emoji */
  skip_tags?: boolean;
}

export interface RuleCore {
  id?: string;
  channel: 'dm' | 'comment';
  name: string;
  trigger: Trigger;
  keywords: string[];
  match_type: MatchType;
  media_ids: string[];
  active_from: number | null;
  active_to: number | null;
  is_active: boolean;
  position?: number;
  action?: 'reply' | 'ignore';
  conditions?: RuleConditions | null;
}

export interface Person {
  /** first time they write to us (DMs) */
  isNew?: boolean | null;
  /** follows our account (null = Instagram didn't say) */
  follows?: boolean | null;
  followers?: number | null;
}

export interface MatchInput {
  channel: 'dm' | 'comment';
  text: string | null;
  kind?: MessageKind;
  mediaId?: string;
  now?: Date;
  person?: Person;
}

export interface TraceRow { rule: string; id?: string; ok: boolean; reason: string }

/* ───────── text ───────── */

export const normalise = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

const hasWord = (msg: string, kw: string) => ` ${msg} `.includes(` ${kw} `) || (kw.length >= 4 && msg.includes(kw));

/** True when a comment is only @mentions and/or emoji/punctuation — nothing to answer. */
export function isTagOrEmojiOnly(text: string | null) {
  const t = String(text || '').replace(/@[\w.]+/g, '').replace(/[\p{P}\p{S}\p{Extended_Pictographic}‍️\s]/gu, '');
  return t.length === 0;
}

export function keywordHit(rule: Pick<RuleCore, 'keywords' | 'match_type' | 'conditions'>, text: string | null) {
  const msg = normalise(text || '');
  if (!msg) return false;
  const kws = rule.keywords.map(normalise).filter(Boolean);
  if (!kws.length) return false;
  const test = (kw: string) => rule.match_type === 'exact' ? msg === kw : rule.match_type === 'starts' ? msg === kw || msg.startsWith(`${kw} `) || (kw.length >= 4 && msg.startsWith(kw)) : hasWord(msg, kw);
  return rule.conditions?.keyword_logic === 'all' ? kws.every(test) : kws.some(test);
}

export const excludedBy = (rule: Pick<RuleCore, 'conditions'>, text: string | null) => {
  const msg = normalise(text || '');
  return (rule.conditions?.exclude || []).map(normalise).find((w) => w && msg && hasWord(msg, w)) || null;
};

/* ───────── time (rules use India time) ───────── */

export const istParts = (d = new Date()) => {
  const t = new Date(d.getTime() + 330 * 60_000);
  return { hour: t.getUTCHours(), day: t.getUTCDay(), date: t.toISOString().slice(0, 10) };
};
export const istHour = (d = new Date()) => istParts(d).hour;

export function inHours(rule: Pick<RuleCore, 'active_from' | 'active_to'>, hour = istHour()) {
  const { active_from: f, active_to: t } = rule;
  if (f == null || t == null || f === t) return true;
  return f < t ? hour >= f && hour < t : hour >= f || hour < t; // overnight e.g. 21 → 9
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

/* ───────── matching ───────── */

/** Why this rule would not fire for this input (null = it fires). */
export function blockReason(rule: RuleCore, input: MatchInput): string | null {
  const c = rule.conditions || {};
  const now = input.now || new Date();
  const ist = istParts(now);
  const kind = input.kind || 'text';
  if (!rule.is_active) return 'Rule is off';
  if (rule.channel !== input.channel) return 'Different channel';

  if (rule.trigger === 'keywords' && !keywordHit(rule, input.text)) return c.keyword_logic === 'all' ? 'Not every keyword is in the message' : 'No keyword in the message';
  if (rule.trigger === 'media' && kind !== 'media') return 'Not a photo, video or shared post';
  if (rule.trigger === 'story' && kind !== 'story') return 'Not a story reply or mention';
  const ex = excludedBy(rule, input.text);
  if (ex) return `Contains “${ex}”, which this rule skips`;

  if (input.channel === 'comment' && rule.media_ids.length && !(input.mediaId && rule.media_ids.includes(input.mediaId))) return 'Comment is on a different post';
  if (input.channel === 'comment' && c.skip_tags && isTagOrEmojiOnly(input.text)) return 'Only tags or emoji — skipped';

  if (!inHours(rule, ist.hour)) return `Only active ${hourLabel(rule.active_from!)}–${hourLabel(rule.active_to!)}`;
  if (c.days?.length && !c.days.includes(ist.day)) return `Only on ${c.days.slice().sort().map((d) => DAY_NAMES[d]).join(', ')}`;
  if (c.starts_on && ist.date < c.starts_on) return `Starts on ${c.starts_on}`;
  if (c.ends_on && ist.date > c.ends_on) return `Ended on ${c.ends_on}`;

  const p = input.person || {};
  if (input.channel === 'dm' && c.audience === 'new' && p.isNew !== true) return 'Only for people writing for the first time';
  if (input.channel === 'dm' && c.audience === 'returning' && p.isNew !== false) return 'Only for people who wrote before';
  if (c.follows === 'followers' && p.follows !== true) return p.follows == null ? 'Instagram didn’t say if they follow you' : 'They don’t follow you';
  if (c.follows === 'non_followers' && p.follows !== false) return p.follows == null ? 'Instagram didn’t say if they follow you' : 'They already follow you';
  if ((c.min_followers || 0) > 0 && !((p.followers ?? -1) >= c.min_followers!)) return p.followers == null ? 'Their follower count is unknown' : `They have fewer than ${c.min_followers!.toLocaleString('en-IN')} followers`;
  return null;
}

/** Specific triggers first (list order), then catch-alls (post-specific before general). */
export function orderRules<T extends RuleCore>(rules: T[]): T[] {
  const byPos = [...rules].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const specific = byPos.filter((r) => r.trigger !== 'any');
  const anyPost = byPos.filter((r) => r.trigger === 'any' && r.media_ids.length);
  const anyAll = byPos.filter((r) => r.trigger === 'any' && !r.media_ids.length);
  return [...specific, ...anyPost, ...anyAll];
}

/** The rule that fires (or null), plus a line per rule explaining the decision. */
export function matchRule<T extends RuleCore>(rules: T[], input: MatchInput): { rule: T | null; trace: TraceRow[] } {
  const trace: TraceRow[] = [];
  let hit: T | null = null;
  for (const r of orderRules(rules.filter((x) => x.channel === input.channel))) {
    if (hit) { trace.push({ rule: r.name, id: r.id, ok: false, reason: 'A rule above already matched' }); continue; }
    const why = blockReason(r, input);
    if (why) trace.push({ rule: r.name, id: r.id, ok: false, reason: why });
    else { hit = r; trace.push({ rule: r.name, id: r.id, ok: true, reason: r.action === 'ignore' ? 'Matches — stays silent' : 'Matches — replies' }); }
  }
  return { rule: hit, trace };
}

/** Does any rule need to know who the person is (costs an Instagram call)? */
export const needsProfile = (rules: RuleCore[]) => rules.some((r) => {
  const c = r.conditions || {};
  return (c.follows && c.follows !== 'any') || (c.min_followers || 0) > 0;
});

/* ───────── reply text ───────── */

export interface TextVars {
  username?: string | null; name?: string | null; now?: Date;
  /** the trip a trip-cards reply is about (matched by name, or the single picked trip) */
  trip?: string | null;
  /** what the person wrote (+ the post caption for comments) — used to match trips */
  message?: string | null;
}

export const greeting = (d = new Date()) => {
  const h = istHour(d);
  return h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/**
 * Fill a reply:
 *   {username} → @handle · {name} → display name (or @handle) · {first_name}
 *   {greeting} → Good morning / afternoon / evening (IST) · {day} → Monday …
 *   {trip} → the trip they asked about (trip-card replies), else “trips”
 *   {Hi|Hey|Hello} → one of the options at random
 */
export function renderText(text: string, vars: TextVars, rand: () => number = Math.random) {
  const handle = vars.username ? `@${vars.username}` : '';
  const full = (vars.name || '').trim();
  const first = full.split(/\s+/)[0] || '';
  const now = vars.now || new Date();
  return String(text || '')
    .replace(/\{username\}/gi, handle)
    .replace(/\{first_name\}/gi, first || handle)
    .replace(/\{name\}/gi, full || handle)
    .replace(/\{greeting\}/gi, greeting(now))
    .replace(/\{trip\}/gi, vars.trip || 'trips')
    .replace(/\{day\}/gi, new Date(now.getTime() + 330 * 60_000).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' }))
    .replace(/\{([^{}|]*\|[^{}]*)\}/g, (_, opts: string) => { const o = opts.split('|'); return o[Math.floor(rand() * o.length)] ?? ''; })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?])/g, '$1')
    .replace(/^\s+|\s+$/g, '');
}

/** Clean conditions coming from the admin UI. */
export function cleanConditions(raw: any, channel: 'dm' | 'comment'): RuleConditions {
  const n = (v: any, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
  const words = (v: any) => Array.from(new Set((Array.isArray(v) ? v : []).map((k: any) => String(k).trim().toLowerCase()).filter(Boolean).map((k: string) => k.slice(0, 40)))).slice(0, 30) as string[];
  const date = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const out: RuleConditions = {
    keyword_logic: raw?.keyword_logic === 'all' ? 'all' : 'any',
    exclude: words(raw?.exclude),
    audience: channel === 'dm' && ['new', 'returning'].includes(raw?.audience) ? raw.audience : 'everyone',
    follows: ['followers', 'non_followers'].includes(raw?.follows) ? raw.follows : 'any',
    min_followers: n(raw?.min_followers, 0, 10_000_000),
    days: Array.from(new Set((Array.isArray(raw?.days) ? raw.days : []).map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))).sort() as number[],
    starts_on: date(raw?.starts_on),
    ends_on: date(raw?.ends_on),
    delay_minutes: n(raw?.delay_minutes, 0, 1440),
    daily_limit: n(raw?.daily_limit, 0, 10_000),
    mute_hours: n(raw?.mute_hours, 0, 720),
    skip_tags: channel === 'comment' ? !!raw?.skip_tags : false,
  };
  if (out.days!.length === 7) out.days = [];
  return out;
}
