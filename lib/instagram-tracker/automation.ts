import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  IgApiError, getConversations, getRecentComments, getUserProfile, messageKind, ownId, replyToComment, sendMessage,
} from './api';
import { buildMessages, fill, loadLiveTrips, picker, plainText, siteUrlFrom, tripsFor, type ReplyRow, type RuleRow } from './messages';
import type { TripRow } from './trip-pick';
import { istParts, matchRule, needsProfile, type Person, type TextVars } from './rules-core';

/**
 * Inbox sync + rule-based auto replies. Runs every minute from cron, "Run now",
 * and a few seconds after each webhook event.
 *
 * 1. Pull the latest DM conversations and comments on recent posts into Postgres.
 * 2. For each new message/comment, find the first matching rule (rules-core.ts):
 *    keywords / photo-or-share / story reply, then catch-alls; conditions on
 *    words to skip, hours, days, campaign dates, new vs returning, followers.
 * 3. Send-time checks: wait N minutes (and skip if the team answered meanwhile),
 *    once per person per rule, daily cap per rule, person muted (handed to the
 *    team), team replied in this chat recently. "Stay silent" rules send nothing.
 *
 * Safety rails
 * - master switches + only items that arrive after a switch was turned on
 * - DMs: inside Instagram's 24h window, only if the newest message is theirs
 * - comments: top-level only, never ours, one public reply + at most one DM
 * - ≤ 15 sends per run, spaced; rate limit → pause 30 min
 * - a rich message Instagram refuses is resent as plain text with the links
 */

export interface SyncSummary {
  ran: boolean;
  reason?: 'locked' | 'paused';
  dmsSynced: number;
  commentsSynced: number;
  dmReplies: number;
  commentReplies: number;
  privateReplies: number;
  failed: number;
  error?: string;
}

const MAX_SENDS_PER_RUN = 15;
const GAP_MS = 1200;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fill variables once so the logged summary is exactly what was sent (random {a|b} picks included). */
const resolve = (reply: ReplyRow, vars: TextVars): ReplyRow => ({
  ...reply,
  text: fill(reply.text, vars),
  title: reply.title ? fill(reply.title, vars) : reply.title,
  options: {
    ...reply.options,
    ...(reply.options?.before_text ? { before_text: fill(reply.options.before_text, vars) } : {}),
    ...(reply.options?.after_text ? { after_text: fill(reply.options.after_text, vars) } : {}),
  },
});

/**
 * Send a saved reply as rich message(s); fall back to plain text if Instagram
 * refuses the template. Private replies (to a comment) allow ONE message only.
 */
export async function sendReply(
  to: { id: string } | { comment_id: string },
  raw: ReplyRow,
  vars: TextVars,
  siteUrl: string,
  trips?: TripRow[],
): Promise<{ messageId: string | null; summary: string; fellBack: boolean }> {
  // Trips first: the cards decide what {trip} means in the text.
  const { cards, tripName } = await tripsFor(raw, vars.message || '', siteUrl, trips);
  const reply = resolve(raw, { ...vars, trip: tripName });
  const none: TextVars = {};
  let msgs = await buildMessages(reply, none, siteUrl, cards);
  const single = 'comment_id' in to;
  // Private replies allow one message: send the cards (or card), not the intro.
  if (single && msgs.length > 1) msgs = [msgs.find((m) => 'attachment' in m) || msgs[msgs.length - 1]];
  if (!msgs.length) msgs = [{ text: plainText(reply, none, cards) || reply.text || ' ' }];

  let messageId: string | null = null;
  try {
    for (let i = 0; i < msgs.length; i++) {
      if (i) await sleep(600);
      const r = await sendMessage(to, msgs[i]);
      messageId = r?.message_id || messageId;
      if (single) break;
    }
    return { messageId, summary: summaryText(reply, cards), fellBack: false };
  } catch (e: any) {
    const rich = msgs.some((m) => 'attachment' in m || 'quick_replies' in m);
    // Only retry content problems — never rate limits or token errors.
    if (!rich || !(e instanceof IgApiError) || e.kind !== 'failed' || (single && messageId)) throw e;
    const text = plainText(reply, none, cards);
    if (!text) throw e;
    const r = await sendMessage(to, { text });
    return { messageId: r?.message_id || null, summary: text, fellBack: true };
  }
}

const summaryText = (r: ReplyRow, cards: { title: string }[]) =>
  r.format === 'trips' ? [r.text, cards.length ? `Trip cards: ${cards.map((c) => c.title).join(', ')}` : ''].filter(Boolean).join(' · ').slice(0, 1000)
    : plainText(r, {}) || summaryOf(r);

const summaryOf = (r: ReplyRow) => (r.format === 'trips' ? 'Trip cards' : r.title || r.text || 'Reply');
const needsName = (replies: ReplyRow[]) => replies.some((r) => /\{(first_)?name\}/i.test(`${r.text} ${r.title || ''}`));

export async function runInboxSync(opts: { trigger: 'cron' | 'manual'; log?: (m: string) => void } = { trigger: 'cron' }): Promise<SyncSummary> {
  const log = opts.log || (() => {});
  const db = createAdminClient();
  const me = ownId();
  const s: SyncSummary = { ran: false, dmsSynced: 0, commentsSynced: 0, dmReplies: 0, commentReplies: 0, privateReplies: 0, failed: 0 };

  const { data: cfg } = await db.from('instagram_automation').select('*').eq('id', 1).maybeSingle();
  if (cfg?.paused_until && new Date(cfg.paused_until).getTime() > Date.now()) { s.reason = 'paused'; return s; }

  const owner = `${opts.trigger}:${randomUUID().slice(0, 8)}`;
  const { data: locked, error: lockErr } = await db.rpc('instagram_try_lock', { p_name: 'inbox', p_owner: owner, p_seconds: 180 });
  if (lockErr) throw new Error(lockErr.message);
  if (!locked) { s.reason = 'locked'; return s; }
  s.ran = true;

  let budget = MAX_SENDS_PER_RUN;
  const nowIso = () => new Date().toISOString();
  const errors: string[] = [];
  const siteUrl = siteUrlFrom(cfg?.site_url);
  const humanPauseH = Number.isFinite(Number(cfg?.human_pause_hours)) ? Number(cfg.human_pause_hours) : 12;

  try {
    const [{ data: ruleRows }, { data: replyRows }] = await Promise.all([
      db.from('instagram_reply_rules').select('*').eq('is_active', true).order('position'),
      db.from('instagram_reply_templates').select('*').eq('is_active', true).not('rule_id', 'is', null).order('created_at'),
    ]);
    const rules = ((ruleRows || []) as RuleRow[]).map((r) => ({ ...r, conditions: r.conditions || {}, action: r.action || 'reply' }));
    const replies = (replyRows || []) as ReplyRow[];
    const pickers = new Map<string, () => ReplyRow | null>();
    const pick = (rule: RuleRow, kind: 'dm' | 'comment') => {
      const key = `${rule.id}:${kind}`;
      if (!pickers.has(key)) pickers.set(key, picker(replies.filter((r) => r.rule_id === rule.id && r.kind === kind), rule.reply_mode));
      return pickers.get(key)!();
    };
    let tripPool: TripRow[] | null = null;
    const tripsOnce = async (r: ReplyRow) => (r.format === 'trips' ? (tripPool ??= await loadLiveTrips()) : undefined);
    const record = async (row: Record<string, unknown>) => {
      await db.from('instagram_auto_replies').insert(row);
      if (row.status === 'sent' && row.template_id) await db.rpc('instagram_template_used', { p_id: row.template_id });
    };

    /* ── shared send-time checks ── */
    const wantProfile = (channel: 'dm' | 'comment') => needsProfile(rules.filter((r) => r.channel === channel)) || needsName(replies);
    const profiles = new Map<string, Awaited<ReturnType<typeof getUserProfile>>>();
    const profileOf = async (id: string | null) => {
      if (!id) return null;
      if (!profiles.has(id)) profiles.set(id, await getUserProfile(id));
      return profiles.get(id) || null;
    };
    const mutedUntil = async (id: string | null) => {
      if (!id) return null;
      const { data } = await db.from('instagram_reply_mutes').select('until').eq('recipient_id', id).gt('until', nowIso()).maybeSingle();
      return data?.until || null;
    };
    const mute = async (rule: RuleRow, id: string | null, username: string | null, from: number) => {
      const h = rule.conditions?.mute_hours || 0;
      if (!h || !id) return;
      await db.from('instagram_reply_mutes').upsert({ recipient_id: id, username, until: new Date(from + h * HOUR).toISOString(), rule_id: rule.id }, { onConflict: 'recipient_id' });
    };
    /** Once per person per rule, and the rule's daily cap. Returns why it's blocked, or null. */
    const limited = async (rule: RuleRow, kind: string, recipient: string | null) => {
      if (rule.cooldown_hours > 0 && recipient) {
        const { data } = await db.from('instagram_auto_replies').select('id').eq('kind', kind).eq('rule_id', rule.id).eq('recipient_id', recipient).eq('status', 'sent')
          .gte('created_at', new Date(Date.now() - rule.cooldown_hours * HOUR).toISOString()).limit(1);
        if (data?.length) return 'cooldown';
      }
      const cap = rule.conditions?.daily_limit || 0;
      if (cap > 0) {
        const midnightIst = new Date(`${istParts().date}T00:00:00+05:30`).toISOString();
        const { count } = await db.from('instagram_auto_replies').select('id', { count: 'exact', head: true }).eq('rule_id', rule.id).eq('status', 'sent').gte('created_at', midnightIst);
        if ((count || 0) >= cap) return 'daily cap';
      }
      return null;
    };

    /* ── DMs ── */
    try {
      const convs = await getConversations(25, 10);
      const rows: any[] = [];
      const latest: { conv: string; msg: any; userId: string; username: string | null; history: any[] }[] = [];
      for (const c of convs) {
        const other = (c.participants?.data || []).find((p: any) => p.id !== me) || {};
        const msgs = (c.messages?.data || []) as any[];
        msgs.forEach((m) => rows.push({
          id: m.id, conversation_id: c.id, direction: m.from?.id === me ? 'out' : 'in',
          user_id: other.id || null, username: other.username || null,
          text: m.message || null, has_attachment: messageKind(m) !== 'text' || !m.message,
          created_at: m.created_time,
        }));
        if (msgs[0]) latest.push({ conv: c.id, msg: msgs[0], userId: other.id, username: other.username || null, history: msgs });
      }
      if (rows.length) {
        const { error } = await db.from('instagram_dm_messages').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
      s.dmsSynced = rows.length;

      if (cfg?.dm_enabled && cfg.dm_enabled_at) {
        const since = Math.max(new Date(cfg.dm_enabled_at).getTime(), Date.now() - DAY + 5 * 60_000);
        const due = latest.filter((l) => l.msg.from?.id !== me && l.userId && new Date(l.msg.created_time).getTime() >= since);
        if (due.length) {
          const { data: done } = await db.from('instagram_auto_replies').select('target_id').eq('kind', 'dm').in('target_id', due.map((d) => d.msg.id));
          const answered = new Set((done || []).map((d: any) => d.target_id));
          const dmProfile = wantProfile('dm');
          for (const d of due) {
            if (budget <= 0 || answered.has(d.msg.id)) continue;
            const at = new Date(d.msg.created_time).getTime();
            if (await mutedUntil(d.userId)) continue;                       // handed over to the team
            if (humanPauseH > 0 && await teamRepliedRecently(db, d.conv, d.userId, humanPauseH)) continue;

            const person: Person = { isNew: await isFirstContact(db, d.userId, at, d.history, me) };
            const prof = dmProfile ? await profileOf(d.userId) : null;
            if (prof) { person.follows = prof.follows; person.followers = prof.followers; }

            const { rule } = matchRule(rules, { channel: 'dm', text: d.msg.message || null, kind: messageKind(d.msg), person });
            if (!rule) continue;
            const wait = (rule.conditions?.delay_minutes || 0) * 60_000;
            if (wait && Date.now() - at < wait) continue;                  // not yet — next run checks again
            if (rule.action === 'ignore') { await mute(rule, d.userId, d.username, at); continue; }
            if (await limited(rule, 'dm', d.userId)) continue;

            const reply = pick(rule, 'dm');
            if (!reply) continue;
            budget--;
            const vars: TextVars = { username: d.username, name: prof?.name, message: d.msg.message || '' };
            try {
              const r = await sendReply({ id: d.userId }, reply, vars, siteUrl, await tripsOnce(reply));
              s.dmReplies++;
              await record({ kind: 'dm', target_id: d.msg.id, recipient_id: d.userId, recipient: d.username, template_id: reply.id, rule_id: rule.id, text: r.summary, status: 'sent', error: r.fellBack ? 'Sent as plain text — Instagram refused the buttons/cards' : null });
              if (r.messageId) {
                await db.from('instagram_dm_messages').upsert({ id: r.messageId, conversation_id: d.conv, direction: 'out', user_id: d.userId, username: d.username, text: r.summary, is_auto: true, created_at: nowIso() }, { onConflict: 'id' });
              }
              await mute(rule, d.userId, d.username, Date.now());
              log(`DM [${rule.name}] → @${d.username}`);
            } catch (e: any) {
              s.failed++;
              await record({ kind: 'dm', target_id: d.msg.id, recipient_id: d.userId, recipient: d.username, template_id: reply.id, rule_id: rule.id, text: summaryOf(reply), status: 'failed', error: e.message });
              if (e instanceof IgApiError && e.kind !== 'failed') throw e;
            }
            await sleep(GAP_MS);
          }
        }
      }
    } catch (e: any) {
      if (e instanceof IgApiError && e.kind !== 'failed') throw e;
      errors.push(`DMs: ${e.message}`);
    }

    /* ── Comments ── */
    try {
      const media = await getRecentComments(cfg?.comment_posts_to_watch || 10);
      const rows: any[] = [];
      const ownReplied = new Set<string>();
      const byId = new Map<string, { media_id: string; text: string | null; at: number; caption: string }>();
      for (const m of media) {
        for (const c of (m.comments?.data || []) as any[]) {
          const fromId = c.from?.id || null;
          if (fromId === me) continue;
          if ((c.replies?.data || []).some((r: any) => r.from?.id === me)) ownReplied.add(c.id);
          byId.set(c.id, { media_id: m.id, text: c.text || null, at: new Date(c.timestamp).getTime(), caption: m.caption || '' });
          rows.push({ id: c.id, media_id: m.id, media_permalink: m.permalink || null, user_id: fromId, username: c.username || c.from?.username || null, text: c.text || null, created_at: c.timestamp });
        }
      }
      if (rows.length) {
        const { error } = await db.from('instagram_comments').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
      s.commentsSynced = rows.length;
      if (ownReplied.size) {
        await db.from('instagram_comments').update({ replied: true, reply_source: 'manual', replied_at: nowIso() }).in('id', Array.from(ownReplied)).eq('replied', false);
      }

      if (cfg?.comment_enabled && cfg.comment_enabled_at) {
        const since = Math.max(new Date(cfg.comment_enabled_at).getTime(), Date.now() - 7 * DAY + HOUR);
        const { data: pending } = await db.from('instagram_comments').select('id, username, user_id, replied, dm_sent')
          .gte('created_at', new Date(since).toISOString())
          .or('replied.eq.false,dm_sent.eq.false')
          .order('created_at', { ascending: false }).limit(100);
        const cProfile = wantProfile('comment');

        for (const c of (pending || []) as any[]) {
          if (budget <= 0) break;
          const live = byId.get(c.id);
          if (!live) continue; // deleted / hidden / no longer on a watched post
          const prof = cProfile ? await profileOf(c.user_id) : null;
          const person: Person = prof ? { follows: prof.follows, followers: prof.followers } : {};
          const { rule } = matchRule(rules, { channel: 'comment', text: live.text, kind: 'text', mediaId: live.media_id, person });
          if (!rule || rule.action === 'ignore') continue;              // silent rules leave it for the team
          const wait = (rule.conditions?.delay_minutes || 0) * 60_000;
          if (wait && Date.now() - live.at < wait) continue;
          if (!c.replied && await limited(rule, 'comment', c.user_id)) continue;
          // Trips are matched on the comment AND the post's caption — "details" on the Manali reel → Manali.
          const vars: TextVars = { username: c.username, name: prof?.name, message: `${live.text || ''}
${live.caption}` };
          let touched = false;

          const pub = !c.replied && !ownReplied.has(c.id) ? pick(rule, 'comment') : null;
          if (pub) {
            const text = fill(pub.text, vars).slice(0, 300);
            budget--; touched = true;
            try {
              await replyToComment(c.id, text);
              s.commentReplies++;
              await db.from('instagram_comments').update({ replied: true, reply_source: 'auto', reply_text: text, replied_at: nowIso() }).eq('id', c.id);
              await record({ kind: 'comment', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: pub.id, rule_id: rule.id, text, status: 'sent' });
              log(`Comment [${rule.name}] → @${c.username}`);
            } catch (e: any) {
              s.failed++;
              await record({ kind: 'comment', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: pub.id, rule_id: rule.id, text, status: 'failed', error: e.message });
              if (e instanceof IgApiError && e.kind !== 'failed') throw e;
              await db.from('instagram_comments').update({ replied: true, reply_source: 'auto', reply_text: null, replied_at: nowIso() }).eq('id', c.id);
            }
          }

          const dm = rule.send_dm && !c.dm_sent && budget > 0 && !(await mutedUntil(c.user_id)) ? pick(rule, 'dm') : null;
          if (dm) {
            if (touched) await sleep(GAP_MS);
            budget--; touched = true;
            try {
              const r = await sendReply({ comment_id: c.id }, dm, vars, siteUrl, await tripsOnce(dm));
              s.privateReplies++;
              await record({ kind: 'comment_dm', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: dm.id, rule_id: rule.id, text: r.summary, status: 'sent', error: r.fellBack ? 'Sent as plain text — Instagram refused the buttons/cards' : null });
            } catch (e: any) {
              s.failed++;
              await record({ kind: 'comment_dm', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: dm.id, rule_id: rule.id, text: summaryOf(dm), status: 'failed', error: e.message });
              if (e instanceof IgApiError && e.kind !== 'failed') throw e;
            }
            await db.from('instagram_comments').update({ dm_sent: true }).eq('id', c.id); // one private reply per comment, ever
          }
          if (touched) await mute(rule, c.user_id, c.username, Date.now());
          if (touched) await sleep(GAP_MS);
        }
      }
    } catch (e: any) {
      if (e instanceof IgApiError && e.kind !== 'failed') throw e;
      errors.push(`Comments: ${e.message}`);
    }

    await db.from('instagram_automation').update({
      last_sync_at: nowIso(),
      ...(errors.length ? { last_error: errors.join(' · ').slice(0, 500), last_error_at: nowIso() } : {}),
      updated_at: nowIso(),
    }).eq('id', 1);
    if (errors.length) s.error = errors.join(' · ');
    return s;
  } catch (e: any) {
    const rate = e instanceof IgApiError && e.kind === 'rate_limited';
    s.error = e.message;
    await db.from('instagram_automation').update({
      last_sync_at: nowIso(),
      last_error: `${rate ? 'Rate limited — paused 30 min. ' : ''}${e.message}`.slice(0, 500),
      last_error_at: nowIso(),
      ...(rate ? { paused_until: new Date(Date.now() + 30 * 60_000).toISOString() } : {}),
      updated_at: nowIso(),
    }).eq('id', 1);
    return s;
  } finally {
    await db.rpc('instagram_unlock', { p_name: 'inbox', p_owner: owner });
  }
}

type Db = ReturnType<typeof createAdminClient>;

/**
 * First time this person writes to us: nothing from this person (either way)
 * older than 30 minutes before this message — in the API history or in our store.
 */
async function isFirstContact(db: Db, userId: string, at: number, history: any[], me: string) {
  const cutoff = at - 30 * 60_000;
  if (history.some((m) => new Date(m.created_time).getTime() < cutoff && (m.from?.id === me || m.from?.id === userId))) return false;
  const { data } = await db.from('instagram_dm_messages').select('id').eq('user_id', userId).lt('created_at', new Date(cutoff).toISOString()).limit(1);
  return !data?.length;
}

/**
 * Did a person from the team (not the bot) write in this chat within the last N hours?
 * Our own auto messages are flagged is_auto; an unflagged message sent within two
 * minutes of an auto reply (e.g. the intro before trip cards) also counts as the bot.
 */
async function teamRepliedRecently(db: Db, conv: string, userId: string, hours: number) {
  const from = new Date(Date.now() - hours * HOUR).toISOString();
  const { data: outs } = await db.from('instagram_dm_messages').select('created_at').eq('conversation_id', conv).eq('direction', 'out').eq('is_auto', false)
    .gte('created_at', from).order('created_at', { ascending: false }).limit(5);
  if (!outs?.length) return false;
  const { data: autos } = await db.from('instagram_auto_replies').select('created_at').eq('recipient_id', userId).eq('status', 'sent').gte('created_at', from).limit(50);
  const autoTimes = (autos || []).map((a: any) => new Date(a.created_at).getTime());
  return outs.some((o: any) => {
    const t = new Date(o.created_at).getTime();
    return !autoTimes.some((a) => Math.abs(a - t) < 2 * 60_000);
  });
}

/** Purge old synced rows (keeps the tables small). */
export async function pruneInbox() {
  const db = createAdminClient();
  const cutoff = new Date(Date.now() - 90 * DAY).toISOString();
  await Promise.all([
    db.from('instagram_dm_messages').delete().lt('created_at', cutoff),
    db.from('instagram_comments').delete().lt('created_at', cutoff),
    db.from('instagram_auto_replies').delete().lt('created_at', cutoff),
    db.from('instagram_reply_mutes').delete().lt('until', new Date().toISOString()),
  ]);
}
