import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  IgApiError, getConversations, getRecentComments, ownId, replyToComment, sendDm, sendPrivateReply,
} from './api';

/**
 * Inbox sync + auto replies. Runs every minute from cron (and from "Sync now").
 *
 * 1. Pull the latest DM conversations and comments on recent posts into Postgres
 *    (this powers "DMs today / replied" even when auto reply is off).
 * 2. If enabled, answer with a saved reply (fixed or random) — never AI.
 *
 * Safety rails
 * - only messages/comments that arrive AFTER auto reply was switched on
 * - DMs: only inside Instagram's 24h window, only if the newest message in the
 *   chat is theirs (a human already answered → skip), and at most one auto reply
 *   per person per cooldown
 * - comments: top-level only, never our own, never ones we already answered
 * - max replies per run + spacing; rate limit → pause 30 min
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

const MAX_REPLIES_PER_RUN = 15;
const GAP_MS = 1200;
const DAY = 86_400_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Template = { id: string; kind: 'dm' | 'comment'; text: string; pinned: boolean };

function picker(templates: Template[], mode: 'fixed' | 'random') {
  let last: string | null = null;
  return (): Template | null => {
    if (!templates.length) return null;
    if (mode === 'fixed') return templates.find((t) => t.pinned) || templates[0];
    // Random, but avoid sending the same text twice in a row.
    const pool = templates.length > 1 ? templates.filter((t) => t.id !== last) : templates;
    const t = pool[Math.floor(Math.random() * pool.length)];
    last = t.id;
    return t;
  };
}

export const renderReply = (text: string, vars: { username?: string | null }) =>
  text.replace(/\{username\}/gi, vars.username ? `@${vars.username}` : '').replace(/\s{2,}/g, ' ').trim();

export async function runInboxSync(opts: { trigger: 'cron' | 'manual'; log?: (m: string) => void } = { trigger: 'cron' }): Promise<SyncSummary> {
  const log = opts.log || (() => {});
  const db = createAdminClient();
  const me = ownId();
  const s: SyncSummary = { ran: false, dmsSynced: 0, commentsSynced: 0, dmReplies: 0, commentReplies: 0, privateReplies: 0, failed: 0 };

  const { data: cfg } = await db.from('instagram_automation').select('*').eq('id', 1).maybeSingle();
  if (cfg?.paused_until && new Date(cfg.paused_until).getTime() > Date.now()) {
    s.reason = 'paused';
    return s;
  }

  const owner = `${opts.trigger}:${randomUUID().slice(0, 8)}`;
  const { data: locked, error: lockErr } = await db.rpc('instagram_try_lock', { p_name: 'inbox', p_owner: owner, p_seconds: 180 });
  if (lockErr) throw new Error(lockErr.message);
  if (!locked) { s.reason = 'locked'; return s; }
  s.ran = true;

  let budget = MAX_REPLIES_PER_RUN;
  const nowIso = () => new Date().toISOString();
  const errors: string[] = [];

  try {
    const { data: tpls } = await db.from('instagram_reply_templates').select('id, kind, text, pinned').eq('is_active', true).order('created_at');
    const dmTpl = (tpls || []).filter((t: any) => t.kind === 'dm') as Template[];
    const cmTpl = (tpls || []).filter((t: any) => t.kind === 'comment') as Template[];
    const pickDm = picker(dmTpl, cfg?.dm_mode || 'random');
    const pickCm = picker(cmTpl, cfg?.comment_mode || 'random');

    const recordReply = async (row: Record<string, unknown>) => {
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
        msgs.forEach((m) => {
          const out = m.from?.id === me;
          rows.push({
            id: m.id, conversation_id: c.id, direction: out ? 'out' : 'in',
            user_id: other.id || null, username: other.username || null,
            text: m.message || null, has_attachment: Boolean(m.attachments?.data?.length) || !m.message,
            created_at: m.created_time,
          });
        });
        if (msgs[0]) latest.push({ conv: c.id, msg: msgs[0], userId: other.id, username: other.username || null });
      }
      if (rows.length) {
        const { error } = await db.from('instagram_dm_messages').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
      s.dmsSynced = rows.length;

      if (cfg?.dm_enabled && cfg.dm_enabled_at && dmTpl.length) {
        const since = Math.max(new Date(cfg.dm_enabled_at).getTime(), Date.now() - DAY + 5 * 60_000);
        const due = latest.filter((l) => l.msg.from?.id !== me && l.userId && new Date(l.msg.created_time).getTime() >= since);
        if (due.length) {
          const ids = due.map((d) => d.msg.id);
          const { data: done } = await db.from('instagram_auto_replies').select('target_id').eq('kind', 'dm').in('target_id', ids);
          const answered = new Set((done || []).map((d: any) => d.target_id));
          const cooldownMs = (cfg.dm_cooldown_hours || 0) * 3_600_000;
          for (const d of due) {
            if (budget <= 0 || answered.has(d.msg.id)) continue;
            if (cooldownMs > 0) {
              const { data: recent } = await db.from('instagram_auto_replies').select('id').eq('kind', 'dm').eq('recipient_id', d.userId).eq('status', 'sent')
                .gte('created_at', new Date(Date.now() - cooldownMs).toISOString()).limit(1);
              if (recent?.length) continue;
            }
            const t = pickDm();
            if (!t) break;
            const text = renderReply(t.text, { username: d.username });
            budget--;
            try {
              const r = await sendDm(d.userId, text);
              s.dmReplies++;
              await recordReply({ kind: 'dm', target_id: d.msg.id, recipient_id: d.userId, recipient: d.username, template_id: t.id, text, status: 'sent' });
              if (r?.message_id) {
                await db.from('instagram_dm_messages').upsert({ id: r.message_id, conversation_id: d.conv, direction: 'out', user_id: d.userId, username: d.username, text, is_auto: true, created_at: nowIso() }, { onConflict: 'id' });
              }
              log(`DM → @${d.username}`);
            } catch (e: any) {
              s.failed++;
              await recordReply({ kind: 'dm', target_id: d.msg.id, recipient_id: d.userId, recipient: d.username, template_id: t.id, text, status: 'failed', error: e.message });
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
      const byId = new Map<string, any>();
      for (const m of media) {
        for (const c of (m.comments?.data || []) as any[]) {
          const fromId = c.from?.id || null;
          if (fromId === me) continue; // our own comments
          if ((c.replies?.data || []).some((r: any) => r.from?.id === me)) ownReplied.add(c.id);
          byId.set(c.id, { ...c, media_id: m.id, permalink: m.permalink });
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

      if (cfg?.comment_enabled && cfg.comment_enabled_at && (cmTpl.length || (cfg.comment_dm_enabled && dmTpl.length))) {
        const since = Math.max(new Date(cfg.comment_enabled_at).getTime(), Date.now() - 7 * DAY + 3_600_000);
        const { data: pending } = await db.from('instagram_comments').select('id, username, user_id, replied, dm_sent')
          .gte('created_at', new Date(since).toISOString())
          .or('replied.eq.false,dm_sent.eq.false')
          .order('created_at', { ascending: true }).limit(50);

        for (const c of (pending || []) as any[]) {
          if (budget <= 0) break;
          if (!byId.has(c.id)) continue; // no longer visible (deleted / hidden)
          let touched = false;

          if (!c.replied && !ownReplied.has(c.id) && cmTpl.length) {
            const t = pickCm()!;
            const text = renderReply(t.text, { username: c.username });
            budget--; touched = true;
            try {
              await replyToComment(c.id, text);
              s.commentReplies++;
              await db.from('instagram_comments').update({ replied: true, reply_source: 'auto', reply_text: text, replied_at: nowIso() }).eq('id', c.id);
              await recordReply({ kind: 'comment', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: t.id, text, status: 'sent' });
              log(`Comment reply → @${c.username}`);
            } catch (e: any) {
              s.failed++;
              await recordReply({ kind: 'comment', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: t.id, text, status: 'failed', error: e.message });
              // Don't retry a comment that can't be answered (deleted, restricted…).
              if (!(e instanceof IgApiError) || e.kind === 'failed') await db.from('instagram_comments').update({ replied: true, reply_source: 'auto', reply_text: null, replied_at: nowIso() }).eq('id', c.id);
              else throw e;
            }
          }

          if (cfg.comment_dm_enabled && !c.dm_sent && dmTpl.length && budget > 0) {
            if (touched) await sleep(GAP_MS);
            const t = pickDm()!;
            const text = renderReply(t.text, { username: c.username });
            budget--; touched = true;
            try {
              await sendPrivateReply(c.id, text);
              s.privateReplies++;
              await recordReply({ kind: 'comment_dm', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: t.id, text, status: 'sent' });
            } catch (e: any) {
              s.failed++;
              await recordReply({ kind: 'comment_dm', target_id: c.id, recipient_id: c.user_id, recipient: c.username, template_id: t.id, text, status: 'failed', error: e.message });
              if (e instanceof IgApiError && e.kind !== 'failed') throw e;
            }
            // Private replies are allowed once per comment — never retry.
            await db.from('instagram_comments').update({ dm_sent: true }).eq('id', c.id);
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
