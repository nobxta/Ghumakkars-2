import { createAdminClient } from '@/lib/supabase/admin';
import { inHours, istHour, keywordHit, matchRule, renderText, type MatchInput, type RuleCore, type TextVars } from './rules-core';
import { DEFAULT_FIELDS, chooseTrips, tripSubtitle, tripUrl, type TripField, type TripOptions, type TripPick, type TripRow } from './trip-pick';

/** Reply options: trip-card settings, plus extra messages around cards. */
export interface ReplyOptions extends TripOptions {
  /** card format: a text message sent before the card */
  before_text?: string;
  /** card / trip cards: a follow-up message after them, optionally with quick replies */
  after_text?: string;
  after_quick?: string[];
}

/**
 * Rich Instagram replies + rule matching. Pure helpers shared by the auto-reply
 * engine, the rules API (validation) and the test-send endpoint.
 *
 * Instagram limits (Messenger Platform for Instagram docs):
 *  - text message ≤ 1000 bytes; button template text ≤ 640 chars, 1–3 buttons
 *  - generic template: ≤ 10 cards, title/subtitle ≤ 80 chars, ≤ 3 buttons per card
 *  - quick replies: ≤ 13, title ≤ 20 chars, text messages only
 */

export type ReplyFormat = 'text' | 'card' | 'trips';
export interface ReplyButton { title: string; url: string }

export interface ReplyRow {
  id: string;
  rule_id: string | null;
  kind: 'dm' | 'comment';
  format: ReplyFormat;
  text: string;
  title: string | null;
  image_url: string | null;
  buttons: ReplyButton[];
  quick_replies: string[];
  options: ReplyOptions;
  is_active: boolean;
  pinned: boolean;
}

export interface RuleRow extends RuleCore {
  id: string;
  reply_mode: 'random' | 'fixed';
  cooldown_hours: number;
  send_dm: boolean;
  position: number;
}

export const LIMITS = {
  text: 1000, buttonText: 640, comment: 300, cardTitle: 80, cardSubtitle: 80,
  buttons: 3, buttonTitle: 20, quickReplies: 13, quickReplyTitle: 20, trips: 10,
};

/* ───────── text helpers ───────── */

export const fill = (text: string, vars: TextVars) => renderText(text, vars);

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* ───────── matching (see rules-core.ts) ───────── */

export { istHour, inHours, keywordHit };

/** The rule for an incoming message/comment — first match in rules-core order. */
export function pickRule(rules: RuleRow[], channel: 'dm' | 'comment', text: string | null, mediaId?: string, extra: Omit<MatchInput, 'channel' | 'text' | 'mediaId'> = {}) {
  return matchRule(rules, { channel, text, mediaId, ...extra }).rule;
}

export function picker<T extends { id: string; pinned: boolean }>(items: T[], mode: 'fixed' | 'random') {
  let last: string | null = null;
  return (): T | null => {
    if (!items.length) return null;
    if (mode === 'fixed') return items.find((t) => t.pinned) || items[0];
    const pool = items.length > 1 ? items.filter((t) => t.id !== last) : items;
    const t = pool[Math.floor(Math.random() * pool.length)];
    last = t.id;
    return t;
  };
}

/* ───────── trips as cards ───────── */

export interface TripCard { title: string; subtitle: string; image: string | null; url: string; id?: string }

/** Live trips (not finished/cancelled). Bookable ones go out automatically; any can be picked by hand. */
export async function loadLiveTrips(): Promise<TripRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from('trips')
    .select('id, slug, title, destination, discounted_price, original_price, duration_text, duration_days, start_date, image_url, cover_image_url, is_featured, is_active, status, booking_disabled, short_description, created_at')
    .or('is_active.eq.true,status.eq.active,status.eq.scheduled')
    .order('created_at', { ascending: false })
    .limit(60);
  const past = new Set(['completed', 'cancelled', 'postponed']);
  return (data || [])
    .filter((t: any) => !past.has(t.status || ''))
    .map((t: any) => ({
      id: t.id, slug: t.slug || null, title: String(t.title || 'Trip').trim(), destination: t.destination || null,
      price: Number(t.discounted_price || t.original_price || 0), old_price: Number(t.original_price || 0),
      duration: t.duration_text || (t.duration_days ? `${t.duration_days} days` : ''), description: t.short_description || null,
      start_date: t.start_date || null, image: t.cover_image_url || t.image_url || null,
      featured: !!t.is_featured, bookable: !t.booking_disabled, created_at: String(t.created_at || ''),
    }));
}

export const toCards = (trips: TripRow[], o: ReplyOptions, siteUrl: string): TripCard[] => trips.map((t) => ({
  id: t.id,
  title: clip(t.title, LIMITS.cardTitle),
  subtitle: tripSubtitle(t, o.trip_fields?.length ? o.trip_fields : DEFAULT_FIELDS),
  image: t.image,
  url: tripUrl(t, siteUrl),
}));

/** Pick the trips for a reply and the {trip} name to use in its text. */
export async function tripsFor(reply: Pick<ReplyRow, 'format' | 'options'>, context: string, siteUrl: string, all?: TripRow[]) {
  if (reply.format !== 'trips') return { cards: [] as TripCard[], tripName: null as string | null, matched: false };
  const pool = all || await loadLiveTrips();
  const { trips, matched } = chooseTrips(pool, reply.options || {}, context);
  const named = matched || (reply.options?.trip_pick === 'selected' && trips.length === 1);
  return { cards: toCards(trips, reply.options || {}, siteUrl), tripName: named && trips[0] ? trips[0].title : null, matched };
}

/** @deprecated use tripsFor — kept for older callers. */
export async function loadTripCards(limit: number, siteUrl: string): Promise<TripCard[]> {
  return (await tripsFor({ format: 'trips', options: { trips_limit: limit } }, '', siteUrl)).cards;
}

export const siteUrlFrom = (configured?: string | null) =>
  (configured || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');

/* ───────── message building ───────── */

const btns = (list: ReplyButton[]) => (list || [])
  .filter((b) => b?.title?.trim() && /^https:\/\//i.test(b.url || ''))
  .slice(0, LIMITS.buttons)
  .map((b) => ({ type: 'web_url', url: b.url.trim(), title: clip(b.title.trim(), LIMITS.buttonTitle) }));

const quickOf = (list?: string[]) => (list || []).map((q) => String(q).trim()).filter(Boolean).slice(0, LIMITS.quickReplies)
  .map((q) => ({ content_type: 'text', title: clip(q, LIMITS.quickReplyTitle), payload: q.slice(0, 200) }));

/** A text message, with quick replies when given. */
const textMsg = (text: string, quick?: string[]) => {
  const q = quickOf(quick);
  return q.length ? { text, quick_replies: q } : { text };
};

/**
 * Turn a saved reply into the Instagram message(s) to send, in order:
 *   [text before] → main message (text / card / trip cards) → [follow-up text + quick replies]
 * `cards` = trips already chosen for this person (see tripsFor); loaded if missing.
 */
export async function buildMessages(reply: ReplyRow, vars: TextVars, siteUrl: string, cards?: TripCard[]): Promise<Record<string, unknown>[]> {
  const o = reply.options || {};
  const text = fill(reply.text, vars);
  const buttons = btns(reply.buttons);
  const out: Record<string, unknown>[] = [];
  const before = o.before_text ? fill(o.before_text, vars) : '';
  const after = o.after_text ? fill(o.after_text, vars) : '';

  if (reply.format === 'trips') {
    const list = cards ?? (await tripsFor(reply, vars.message || '', siteUrl)).cards;
    if (text) out.push({ text });
    if (list.length) {
      const label = clip(o.trip_button || 'View trip', LIMITS.buttonTitle);
      const extra = o.trip_extra_button && /^https:\/\//i.test(o.trip_extra_button.url || '') && o.trip_extra_button.title?.trim()
        ? { type: 'web_url', url: o.trip_extra_button.url.trim(), title: clip(o.trip_extra_button.title.trim(), LIMITS.buttonTitle) } : null;
      out.push({
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: list.map((c) => ({
              title: c.title,
              subtitle: c.subtitle || undefined,
              image_url: c.image && /^https:\/\//i.test(c.image) ? c.image : undefined,
              default_action: { type: 'web_url', url: c.url },
              buttons: [{ type: 'web_url', url: c.url, title: label }, ...(extra ? [extra] : [])],
            })),
          },
        },
      });
    }
    if (after) out.push(textMsg(after, o.after_quick));
    return out;
  }

  if (reply.format === 'card') {
    const element: Record<string, unknown> = {
      title: clip(fill(reply.title || '', vars) || text || 'Ghumakkars', LIMITS.cardTitle),
      subtitle: reply.title ? clip(text, LIMITS.cardSubtitle) || undefined : undefined,
      image_url: reply.image_url && /^https:\/\//i.test(reply.image_url) ? reply.image_url : undefined,
    };
    if (buttons.length) {
      element.buttons = buttons;
      element.default_action = { type: 'web_url', url: buttons[0].url };
    }
    if (before) out.push({ text: before });
    out.push({ attachment: { type: 'template', payload: { template_type: 'generic', elements: [element] } } });
    if (after) out.push(textMsg(after, o.after_quick));
    return out;
  }

  // text (+ link buttons) (+ quick replies)
  if (buttons.length) {
    return [{ attachment: { type: 'template', payload: { template_type: 'button', text: clip(text || ' ', LIMITS.buttonText), buttons } } }];
  }
  return [textMsg(text, reply.quick_replies)];
}

/** Plain-text version (for comment replies and as a fallback when a rich message is refused). */
export function plainText(reply: ReplyRow, vars: TextVars, cards: TripCard[] = []) {
  const o = reply.options || {};
  const parts = [
    o.before_text ? fill(o.before_text, vars) : '',
    reply.format === 'card' && reply.title ? fill(reply.title, vars) : '',
    fill(reply.text, vars),
  ].filter(Boolean);
  btns(reply.buttons).forEach((b) => parts.push(`${b.title}: ${b.url}`));
  cards.forEach((c) => parts.push(`${c.title}: ${c.url}`));
  if (o.after_text) parts.push(fill(o.after_text, vars));
  return parts.join('\n').slice(0, LIMITS.text);
}

const FIELDS: TripField[] = ['price', 'old_price', 'duration', 'place', 'description', 'date'];

/** Validate + clean a reply coming from the admin UI. Returns an error string or the cleaned row. */
export function cleanReply(raw: any, kind: 'dm' | 'comment'): { error: string } | { value: Partial<ReplyRow> } {
  const format: ReplyFormat = kind === 'comment' ? 'text' : (['text', 'card', 'trips'].includes(raw?.format) ? raw.format : 'text');
  const text = String(raw?.text ?? '').replace(/\r\n/g, '\n').trim();
  const title = String(raw?.title ?? '').trim();
  const buttons: ReplyButton[] = (Array.isArray(raw?.buttons) ? raw.buttons : [])
    .map((b: any) => ({ title: String(b?.title ?? '').trim(), url: String(b?.url ?? '').trim() }))
    .filter((b: ReplyButton) => b.title || b.url)
    .slice(0, LIMITS.buttons);
  const quick = (Array.isArray(raw?.quick_replies) ? raw.quick_replies : []).map((q: any) => String(q).trim()).filter(Boolean).slice(0, LIMITS.quickReplies);
  const ro = raw?.options || {};

  if (kind === 'comment') {
    if (!text) return { error: 'A comment reply needs text.' };
    if (text.length > LIMITS.comment) return { error: `Comment replies must be ${LIMITS.comment} characters or fewer.` };
  } else if (format === 'text') {
    if (!text) return { error: 'Write the message text.' };
    if (text.length > (buttons.length ? LIMITS.buttonText : LIMITS.text)) return { error: buttons.length ? 'With buttons, text must be 640 characters or fewer.' : 'Text must be 1000 characters or fewer.' };
  } else if (format === 'card') {
    if (!title) return { error: 'A card needs a title.' };
    if (title.length > LIMITS.cardTitle) return { error: 'Card title must be 80 characters or fewer.' };
    if (text.length > LIMITS.cardSubtitle) return { error: 'Card description must be 80 characters or fewer.' };
  } else if (text.length > LIMITS.text) return { error: 'Intro text must be 1000 characters or fewer.' };

  for (const b of buttons) {
    if (!b.title) return { error: 'Every button needs a label.' };
    if (b.title.length > LIMITS.buttonTitle) return { error: `Button labels must be ${LIMITS.buttonTitle} characters or fewer.` };
    if (!/^https:\/\/[^\s]+\.[^\s]+/i.test(b.url)) return { error: `“${b.title}” needs a full link starting with https://` };
  }
  if (format !== 'text' && quick.length) return { error: 'Quick replies only work with plain text messages.' };
  if (buttons.length && quick.length) return { error: 'Use either buttons or quick replies on a message, not both.' };
  if (quick.some((q: string) => q.length > LIMITS.quickReplyTitle)) return { error: `Quick replies must be ${LIMITS.quickReplyTitle} characters or fewer.` };
  const image = String(raw?.image_url ?? '').trim();
  if (format === 'card' && image && !/^https:\/\//i.test(image)) return { error: 'Image link must start with https://' };

  // Extra messages around cards (trips and card formats).
  const options: ReplyOptions = {};
  if (kind === 'dm' && format !== 'text') {
    const before = String(ro.before_text ?? '').trim();
    const after = String(ro.after_text ?? '').trim();
    const afterQuick = (Array.isArray(ro.after_quick) ? ro.after_quick : []).map((q: any) => String(q).trim()).filter(Boolean).slice(0, LIMITS.quickReplies);
    if (before.length > LIMITS.text || after.length > LIMITS.text) return { error: 'Extra messages must be 1000 characters or fewer.' };
    if (afterQuick.some((q: string) => q.length > LIMITS.quickReplyTitle)) return { error: `Quick replies must be ${LIMITS.quickReplyTitle} characters or fewer.` };
    if (afterQuick.length && !after) return { error: 'Quick replies after the cards need a follow-up message.' };
    if (format === 'card' && before) options.before_text = before;
    if (after) options.after_text = after;
    if (afterQuick.length) options.after_quick = afterQuick;
  }
  if (format === 'trips') {
    const pick: TripPick = ro.trip_pick === 'match' || ro.trip_pick === 'selected' ? ro.trip_pick : 'auto';
    const ids = (Array.isArray(ro.trip_ids) ? ro.trip_ids : []).map(String).filter((x: string) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, LIMITS.trips);
    if (pick === 'selected' && !ids.length) return { error: 'Pick at least one trip to send.' };
    const fields = (Array.isArray(ro.trip_fields) ? ro.trip_fields : DEFAULT_FIELDS).filter((f: any) => FIELDS.includes(f));
    let extra: ReplyOptions['trip_extra_button'] = null;
    if (ro.trip_extra_button && (ro.trip_extra_button.title || ro.trip_extra_button.url)) {
      const t = String(ro.trip_extra_button.title || '').trim(), u = String(ro.trip_extra_button.url || '').trim();
      if (!t) return { error: 'The second card button needs a label.' };
      if (t.length > LIMITS.buttonTitle) return { error: `Button labels must be ${LIMITS.buttonTitle} characters or fewer.` };
      if (!/^https:\/\/[^\s]+\.[^\s]+/i.test(u)) return { error: `“${t}” needs a full link starting with https://` };
      extra = { title: t, url: u };
    }
    Object.assign(options, {
      trips_limit: Math.min(LIMITS.trips, Math.max(1, Math.round(Number(ro.trips_limit) || 5))),
      trip_button: String(ro.trip_button || 'View trip').trim().slice(0, LIMITS.buttonTitle) || 'View trip',
      trip_pick: pick,
      trip_ids: pick === 'selected' ? ids : [],
      trip_fallback: ro.trip_fallback === 'text' ? 'text' : 'auto',
      trip_sort: ['cheapest', 'newest', 'soonest'].includes(ro.trip_sort) ? ro.trip_sort : 'featured',
      trip_fields: fields,
      trip_extra_button: extra,
    } satisfies TripOptions);
  }

  return {
    value: {
      kind, format, text,
      title: format === 'card' ? title : null,
      image_url: format === 'card' ? image || null : null,
      buttons: format === 'trips' || kind === 'comment' ? [] : buttons,
      quick_replies: kind === 'comment' || format !== 'text' ? [] : quick,
      options,
      is_active: raw?.is_active !== false,
      pinned: !!raw?.pinned,
    },
  };
}
