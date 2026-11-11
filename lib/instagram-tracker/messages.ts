import { createAdminClient } from '@/lib/supabase/admin';

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
  options: { trips_limit?: number; trip_button?: string };
  is_active: boolean;
  pinned: boolean;
}

export interface RuleRow {
  id: string;
  channel: 'dm' | 'comment';
  name: string;
  trigger: 'any' | 'keywords';
  keywords: string[];
  match_type: 'contains' | 'exact';
  media_ids: string[];
  reply_mode: 'random' | 'fixed';
  cooldown_hours: number;
  send_dm: boolean;
  active_from: number | null;
  active_to: number | null;
  is_active: boolean;
  position: number;
}

export const LIMITS = {
  text: 1000, buttonText: 640, comment: 300, cardTitle: 80, cardSubtitle: 80,
  buttons: 3, buttonTitle: 20, quickReplies: 13, quickReplyTitle: 20, trips: 10,
};

/* ───────── text helpers ───────── */

export const fill = (text: string, vars: { username?: string | null }) =>
  String(text || '').replace(/\{username\}/gi, vars.username ? `@${vars.username}` : '').replace(/[ \t]{2,}/g, ' ').replace(/^\s+|\s+$/g, '');

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const normalise = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/* ───────── matching ───────── */

/** Current hour in India (rules use IST). */
export const istHour = (d = new Date()) => new Date(d.getTime() + 330 * 60_000).getUTCHours();

export function inHours(rule: Pick<RuleRow, 'active_from' | 'active_to'>, hour = istHour()) {
  const { active_from: f, active_to: t } = rule;
  if (f == null || t == null || f === t) return true;
  return f < t ? hour >= f && hour < t : hour >= f || hour < t; // overnight e.g. 21 → 9
}

export function keywordHit(rule: Pick<RuleRow, 'keywords' | 'match_type'>, text: string | null) {
  const msg = normalise(text || '');
  if (!msg) return false;
  return rule.keywords.some((k) => {
    const kw = normalise(k);
    if (!kw) return false;
    if (rule.match_type === 'exact') return msg === kw;
    return ` ${msg} `.includes(` ${kw} `) || (kw.length >= 4 && msg.includes(kw));
  });
}

/**
 * Pick the rule for an incoming message/comment.
 * Keyword rules win (in list order), then post-specific catch-alls, then catch-alls.
 */
export function pickRule(rules: RuleRow[], channel: 'dm' | 'comment', text: string | null, mediaId?: string) {
  const usable = rules
    .filter((r) => r.channel === channel && r.is_active && inHours(r))
    .filter((r) => channel !== 'comment' || !r.media_ids.length || (mediaId && r.media_ids.includes(mediaId)))
    .sort((a, b) => a.position - b.position);
  const kw = usable.find((r) => r.trigger === 'keywords' && keywordHit(r, text));
  if (kw) return kw;
  const anyRules = usable.filter((r) => r.trigger === 'any');
  return anyRules.find((r) => r.media_ids.length) || anyRules[0] || null;
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

export interface TripCard { title: string; subtitle: string; image: string | null; url: string }

export async function loadTripCards(limit: number, siteUrl: string): Promise<TripCard[]> {
  const db = createAdminClient();
  const { data } = await db
    .from('trips')
    .select('id, slug, title, destination, discounted_price, original_price, duration_text, duration_days, start_date, image_url, cover_image_url, is_featured, is_active, status, booking_disabled')
    .or('is_active.eq.true,status.eq.active,status.eq.scheduled')
    .order('created_at', { ascending: false })
    .limit(40);
  const past = new Set(['completed', 'cancelled', 'postponed']);
  return (data || [])
    .filter((t: any) => !past.has(t.status || '') && !t.booking_disabled)
    .sort((a: any, b: any) => Number(!!b.is_featured) - Number(!!a.is_featured))
    .slice(0, Math.min(LIMITS.trips, Math.max(1, limit)))
    .map((t: any) => {
      const price = Number(t.discounted_price || t.original_price || 0);
      const dur = t.duration_text || (t.duration_days ? `${t.duration_days} days` : '');
      const bits = [price ? `From ₹${price.toLocaleString('en-IN')}` : '', dur, t.destination].filter(Boolean);
      return {
        title: clip(String(t.title || 'Trip'), LIMITS.cardTitle),
        subtitle: clip(bits.join(' · '), LIMITS.cardSubtitle),
        image: t.cover_image_url || t.image_url || null,
        url: `${siteUrl.replace(/\/$/, '')}/trips/${t.slug || t.id}`,
      };
    });
}

export const siteUrlFrom = (configured?: string | null) =>
  (configured || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');

/* ───────── message building ───────── */

const btns = (list: ReplyButton[]) => (list || [])
  .filter((b) => b?.title?.trim() && /^https:\/\//i.test(b.url || ''))
  .slice(0, LIMITS.buttons)
  .map((b) => ({ type: 'web_url', url: b.url.trim(), title: clip(b.title.trim(), LIMITS.buttonTitle) }));

/**
 * Turn a saved reply into the Instagram message(s) to send.
 * Returns 1–2 messages (trip cards may be preceded by an intro text).
 */
export async function buildMessages(reply: ReplyRow, vars: { username?: string | null }, siteUrl: string): Promise<Record<string, unknown>[]> {
  const text = fill(reply.text, vars);
  const quick = (reply.quick_replies || []).map((q) => String(q).trim()).filter(Boolean).slice(0, LIMITS.quickReplies)
    .map((q) => ({ content_type: 'text', title: clip(q, LIMITS.quickReplyTitle), payload: q.slice(0, 200) }));
  const buttons = btns(reply.buttons);

  if (reply.format === 'trips') {
    const cards = await loadTripCards(reply.options?.trips_limit || 5, siteUrl);
    if (!cards.length) return text ? [{ text }] : [];
    const label = clip(reply.options?.trip_button || 'View trip', LIMITS.buttonTitle);
    const out: Record<string, unknown>[] = [];
    if (text) out.push({ text });
    out.push({
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: cards.map((c) => ({
            title: c.title,
            subtitle: c.subtitle || undefined,
            image_url: c.image || undefined,
            default_action: { type: 'web_url', url: c.url },
            buttons: [{ type: 'web_url', url: c.url, title: label }],
          })),
        },
      },
    });
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
    return [{ attachment: { type: 'template', payload: { template_type: 'generic', elements: [element] } } }];
  }

  // text (+ link buttons) (+ quick replies)
  if (buttons.length) {
    return [{ attachment: { type: 'template', payload: { template_type: 'button', text: clip(text || ' ', LIMITS.buttonText), buttons } } }];
  }
  return [quick.length ? { text, quick_replies: quick } : { text }];
}

/** Plain-text version (for comment replies and as a fallback when a rich message is refused). */
export function plainText(reply: ReplyRow, vars: { username?: string | null }) {
  const parts = [reply.format === 'card' && reply.title ? fill(reply.title, vars) : '', fill(reply.text, vars)].filter(Boolean);
  btns(reply.buttons).forEach((b) => parts.push(`${b.title}: ${b.url}`));
  return parts.join('\n').slice(0, LIMITS.text);
}

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

  return {
    value: {
      kind, format, text,
      title: format === 'card' ? title : null,
      image_url: format === 'card' ? image || null : null,
      buttons: format === 'trips' || kind === 'comment' ? [] : buttons,
      quick_replies: kind === 'comment' ? [] : quick,
      options: format === 'trips' ? {
        trips_limit: Math.min(LIMITS.trips, Math.max(1, Math.round(Number(raw?.options?.trips_limit) || 5))),
        trip_button: String(raw?.options?.trip_button || 'View trip').trim().slice(0, LIMITS.buttonTitle) || 'View trip',
      } : {},
      is_active: raw?.is_active !== false,
      pinned: !!raw?.pinned,
    },
  };
}
