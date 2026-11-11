import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  IgApiError, getConversations, getRecentComments, ownId, replyToComment, sendMessage,
} from './api';
import {
  buildMessages, fill, pickRule, picker, plainText, siteUrlFrom, type ReplyRow, type RuleRow,
} from './messages';

/**
 * Inbox sync + rule-based auto replies. Runs every minute from cron (and "Run now").
 *
 * 1. Pull the latest DM conversations and comments on recent posts into Postgres.
 * 2. For each new message/comment, find the matching rule
 *    (keyword rules first, then post-specific, then "any other") and send one of
 *    its saved replies — plain text, text + link buttons, a card, or trip cards.
 *
 * Safety rails
 * - master switches + only items that arrive after a switch was turned on
 * - DMs: inside Instagram's 24h window, only if the newest message is theirs,
 *   per-rule cooldown per person
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send a saved reply as rich message(s); fall back to plain text if Instagram
 * refuses the template. Private replies (to a comment) allow ONE message only.
 */
export async function sendReply(
  to: { id: string } | { comment_id: string },
  reply: ReplyRow,
  vars: { username?: string | null },
  siteUrl: string,
): Promise<{ messageId: string | null; summary: string; fellBack: boolean }> {
  let msgs = await buildMessages(reply, vars, siteUrl);
  const single = 'comment_id' in to;
  if (single && msgs.length > 1) msgs = [msgs[msgs.length - 1]];
  if (!msgs.length) msgs = [{ text: plainText(reply, vars) || fill(reply.text, vars) }];

  let messageId: string | null = null;
  try {
    for (let i = 0; i < msgs.length; i++) {
      if (i) await sleep(600);
      const r = await sendMessage(to, msgs[i]);
      messageId = r?.message_id || messageId;
      if (single) break;
    }
    return { messageId, summary: plainText(reply, vars) || summaryOf(reply), fellBack: false };
  } catch (e: any) {
    const rich = msgs.some((m) => 'attachment' in m || 'quick_replies' in m);
    // Only retry content problems — never rate limits or token errors.
    if (!rich || !(e instanceof IgApiError) || e.kind !== 'failed' || (single && messageId)) throw e;
    const text = plainText(reply, vars);
    if (!text) throw e;
    const r = await sendMessage(to, { text });
    return { messageId: r?.message_id || null, summary: text, fellBack: true };
  }
}

const summaryOf = (r: ReplyRow) => (r.format === 'trips' ? 'Trip cards' : r.title || r.text || 'Reply');

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

  try {
    const [{ data: ruleRows }, { data: replyRows }] = await Promise.all([
      db.from('instagram_reply_rules').select('*').eq('is_active', true).order('position'),
      db.from('instagram_reply_templates').select('*').eq('is_active', true).not('rule_id', 'is', null).order('created_at'),
    ]);
    const rules = (ruleRows || []) as RuleRow[];
    const replies = (replyRows || []) as ReplyRow[];
    const pickers = new Map<string, () => ReplyRow | null>();
    const pick = (rule: RuleRow, kind: 'dm' | 'comment') => {
      const key = `${rule.id}:${kind}`;
      if (!pickers.has(key)) pickers.set(key, picker(replies.filter((r) => r.rule_id === rule.id && r.kind === kind), rule.reply_mode));
      return pickers.get(key)!();
    };
    const record = async (row: Record<string, unknown>) => {
      await db.from('instagram_auto_replies').insert(row);
      if (row.status === 'sent' && row.template_id) await db.rpc('instagram_template_used', { p_id: row.template_id });
    };

    /* ── DMs ── */
    try {
      const convs = await getConversations(25, 10);
      const rows: any[] = [];
      const latest: { conv: string; msg: any; userId: string; username: string | null }[] = [];
      for (const c of convs) {
        const other = (c.participants?.data || []).find((p: any) => p.id !== me) || {};
        const msgs = (c.messages?.data || []) as any[];
        msgs.forEach((m) => rows.push({
          id: m.id, conversation_id: c.id, direction: m.from?.id === me ? 'out' : 'in',
          user_id: other.id || null, username: other.username || null,
          text: m.message || null, has_attachment: Boolean(m.attachments?.data?.length) || !m.message,
          created_at: m.created_time,
        }));
        if (msgs[0]) latest.push({ conv: c.id, msg: msgs[0], userId: other.id, username: other.username || null });
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
          for (const d of due) {
            if (budget <= 0 || answered.has(d.msg.id)) continue;
            const rule = pickRule(rules, 'dm', d.msg.message || null);
            if (!rule) continue;
            if (rule.cooldown_hours > 0) {
              const { data: recent } = await db.from('instagram_auto_replies').select('id').eq('kind', 'dm').eq('rule_id', rule.id).eq('recipient_id', d.userId).eq('status', 'sent')
                .gte('created_at', new Date(Date.now() - rule.cooldown_hours * 3_600_000).toISOString()).limit(1);
              if (recent?.length) continue;
            }
            const reply = pick(rule, 'dm');
            if (!reply) continue;
            budget--;
            const vars = { username: d.username };
            try {
              const r = await sendReply({ id: d.userId }, reply, vars, siteUrl);
              s.dmReplies++;
              await record({ kind: 'dm', target_id: d.msg.id, recipient_id: d.userId, recipient: d.username, template_id: reply.id, rule_id: rule.id, text: r.summary, status: 'sent', error: r.fellBack ? 'Sent as plain text — Instagram refused the buttons/cards' : null });
              if (r.messageId) {
                await db.from('instagram_dm_messages').upsert({ id: r.messageId, conversation_id: d.conv, direction: 'out', user_id: d.userId, username: d.username, text: r.summary, is_auto: true, created_at: nowIso() }, { onConflict: 'id' });
              }
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
      const byId = new Map<string, { media_id: string; text: string | null }>();
      for (const m of media) {
        for (const c of (m.comments?.data || []) as any[]) {
          const fromId = c.from?.id || null;
          if (fromId === me) continue;
          if ((c.replies?.data || []).some((r: any) => r.from?.id === me)) ownReplied.add(c.id);
          byId.set(c.id, { media_id: m.id, text: c.text || null });
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
        const since = Math.max(new Date(cfg.comment_enabled_at).getTime(), Date.now() - 7 * DAY + 3_600_000);
        const { data: pending } = await db.from('instagram_comments').select('id, username, user_id, replied, dm_sent')
          .gte('created_at', new Date(since).toISOString())
          .or('replied.eq.false,dm_sent.eq.false')
          .order('created_at', { ascending: false }).limit(100);

        for (const c of (pending || []) as any[]) {
          if (budget <= 0) break;
          const live = byId.get(c.id);
          if (!live) continue; // deleted / hidden / no longer on a watched post
          const rule = pickRule(rules, 'comment', live.text, live.media_id);
          if (!rule) continue;
          const vars = { username: c.username };
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

          const dm = rule.send_dm && !c.dm_sent && budget > 0 ? pick(rule, 'dm') : null;
          if (dm) {
            if (touched) await sleep(GAP_MS);
            budget--; touched = true;
            try {
              const r = await sendReply({ comment_id: c.id }, dm, vars, siteUrl);
              s.privateReplies++;
              await record({ kind: 'comment_dm', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: dm.id, rule_id: rule.id, text: r.summary, status: 'sent', error: r.fellBack ? 'Sent as plain text — Instagram refused the buttons/cards' : null });
            } catch (e: any) {
              s.failed++;
              await record({ kind: 'comment_dm', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: dm.id, rule_id: rule.id, text: summaryOf(dm), status: 'failed', error: e.message });
              if (e instanceof IgApiError && e.kind !== 'failed') throw e;
            }
            await db.from('instagram_comments').update({ dm_sent: true }).eq('id', c.id); // one private reply per comment, ever
          }
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

/** Purge old synced rows (keeps the tables small). */
export async function pruneInbox() {
  const db = createAdminClient();
  const cutoff = new Date(Date.now() - 90 * DAY).toISOString();
  await Promise.all([
    db.from('instagram_dm_messages').delete().lt('created_at', cutoff),
    db.from('instagram_comments').delete().lt('created_at', cutoff),
    db.from('instagram_auto_replies').delete().lt('created_at', cutoff),
  ]);
}
