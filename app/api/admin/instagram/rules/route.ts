import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { cleanReply, siteUrlFrom } from '@/lib/instagram-tracker/messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

/** GET → all rules with their replies, 7-day send counts, and chats you can test-send to. */
export const GET = withErrorLog('admin', 'Instagram rules list', async () => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const db = createAdminClient();
  const [rules, replies, sent, cfg, chats] = await Promise.all([
    db.from('instagram_reply_rules').select('*').order('channel').order('position'),
    db.from('instagram_reply_templates').select('*').not('rule_id', 'is', null).order('created_at'),
    db.from('instagram_auto_replies').select('rule_id, status').gte('created_at', new Date(Date.now() - 7 * DAY).toISOString()).not('rule_id', 'is', null).limit(5000),
    db.from('instagram_automation').select('site_url').eq('id', 1).maybeSingle(),
    // People who wrote in the last 24h — Instagram only allows sending to them.
    db.from('instagram_dm_messages').select('user_id, username, created_at').eq('direction', 'in').gte('created_at', new Date(Date.now() - DAY + 10 * 60_000).toISOString()).order('created_at', { ascending: false }).limit(200),
  ]);
  if (rules.error) return NextResponse.json({ error: rules.error.message }, { status: 500 });

  const counts = new Map<string, { sent: number; failed: number }>();
  (sent.data || []).forEach((r: any) => {
    const c = counts.get(r.rule_id) || { sent: 0, failed: 0 };
    if (r.status === 'sent') c.sent++; else c.failed++;
    counts.set(r.rule_id, c);
  });
  const seen = new Set<string>();
  const testTargets = (chats.data || []).filter((m: any) => m.user_id && !seen.has(m.user_id) && seen.add(m.user_id)).slice(0, 20);

  return NextResponse.json({
    rules: (rules.data || []).map((r: any) => ({ ...r, replies: (replies.data || []).filter((t: any) => t.rule_id === r.id), stats: counts.get(r.id) || { sent: 0, failed: 0 } })),
    siteUrl: siteUrlFrom(cfg.data?.site_url),
    siteUrlConfigured: cfg.data?.site_url || null,
    testTargets,
  });
});

function cleanRule(b: any): { error: string } | { value: Record<string, unknown> } {
  const channel = b?.channel === 'comment' ? 'comment' : b?.channel === 'dm' ? 'dm' : null;
  if (!channel) return { error: 'Choose messages or comments.' };
  const name = String(b?.name || '').trim().slice(0, 80);
  if (!name) return { error: 'Give the rule a name.' };
  const trigger = b?.trigger === 'keywords' ? 'keywords' : 'any';
  const keywords = Array.from(new Set((Array.isArray(b?.keywords) ? b.keywords : []).map((k: any) => String(k).trim().toLowerCase()).filter(Boolean).map((k: string) => k.slice(0, 40)))).slice(0, 30);
  if (trigger === 'keywords' && !keywords.length) return { error: 'Add at least one keyword.' };
  const hour = (v: any) => (v === null || v === '' || v === undefined ? null : Math.min(23, Math.max(0, Math.round(Number(v)))));
  const from = hour(b?.active_from), to = hour(b?.active_to);
  return {
    value: {
      channel, name, trigger, keywords,
      match_type: b?.match_type === 'exact' ? 'exact' : 'contains',
      media_ids: channel === 'comment' ? (Array.isArray(b?.media_ids) ? b.media_ids : []).map(String).filter((x: string) => /^\d+$/.test(x)).slice(0, 50) : [],
      reply_mode: b?.reply_mode === 'fixed' ? 'fixed' : 'random',
      cooldown_hours: channel === 'dm' ? Math.min(720, Math.max(0, Math.round(Number(b?.cooldown_hours) || 0))) : 0,
      send_dm: channel === 'comment' ? !!b?.send_dm : false,
      active_from: from != null && to != null && from !== to ? from : null,
      active_to: from != null && to != null && from !== to ? to : null,
      is_active: b?.is_active !== false,
    },
  };
}

/** Validates the whole rule + replies; returns cleaned pieces. */
function cleanAll(body: any) {
  const r = cleanRule(body?.rule);
  if ('error' in r) return r;
  const rule = r.value;
  const list: any[] = Array.isArray(body?.replies) ? body.replies : [];
  const out: any[] = [];
  for (const raw of list.slice(0, 30)) {
    const kind = raw?.kind === 'comment' ? 'comment' : 'dm';
    if (rule.channel === 'dm' && kind === 'comment') continue;
    if (kind === 'dm' && rule.channel === 'comment' && !rule.send_dm) { /* keep drafts but they stay unused */ }
    const c = cleanReply(raw, kind);
    if ('error' in c) return { error: c.error };
    out.push({ ...c.value, id: typeof raw?.id === 'string' && /^[0-9a-f-]{36}$/i.test(raw.id) ? raw.id : undefined });
  }
  const dms = out.filter((x) => x.kind === 'dm' && x.is_active);
  const pubs = out.filter((x) => x.kind === 'comment' && x.is_active);
  if (rule.channel === 'dm' && !dms.length) return { error: 'Add at least one reply message.' };
  if (rule.channel === 'comment' && !pubs.length && !(rule.send_dm && dms.length)) return { error: 'Add a public reply, or turn on the DM and add a message.' };
  if (rule.channel === 'comment' && rule.send_dm && !dms.length) return { error: 'Add the DM to send, or turn the DM off.' };
  // Exactly one pinned per kind for "same for everyone".
  (['dm', 'comment'] as const).forEach((k) => {
    const g = out.filter((x) => x.kind === k);
    if (g.length && !g.some((x) => x.pinned)) g[0].pinned = true;
    let seen = false;
    g.forEach((x) => { if (x.pinned) { if (seen) x.pinned = false; seen = true; } });
  });
  return { rule, replies: out };
}

async function saveReplies(db: ReturnType<typeof createAdminClient>, ruleId: string, replies: any[]) {
  const keep = replies.filter((r) => r.id).map((r) => r.id);
  let del = db.from('instagram_reply_templates').delete().eq('rule_id', ruleId);
  if (keep.length) del = del.not('id', 'in', `(${keep.join(',')})`);
  const { error: dErr } = await del;
  if (dErr) throw new Error(dErr.message);
  for (const r of replies) {
    const { id, ...row } = r;
    const q = id
      ? db.from('instagram_reply_templates').update({ ...row, rule_id: ruleId }).eq('id', id).eq('rule_id', ruleId)
      : db.from('instagram_reply_templates').insert({ ...row, rule_id: ruleId });
    const { error } = await q;
    if (error) throw new Error(error.message);
  }
}

/** POST { rule, replies } → create. */
export const POST = withErrorLog('admin', 'Instagram rule create', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const c = cleanAll(await request.json().catch(() => ({})));
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 });
  const db = createAdminClient();
  // New keyword rules go above the catch-alls.
  const { data: top } = await db.from('instagram_reply_rules').select('position').eq('channel', c.rule.channel).order('position', { ascending: true }).limit(1);
  const position = c.rule.trigger === 'keywords' ? (top?.[0]?.position ?? 100) - 1 : 200;
  const { data, error } = await db.from('instagram_reply_rules').insert({ ...c.rule, position }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try { await saveReplies(db, data.id, c.replies); } catch (e: any) {
    await db.from('instagram_reply_rules').delete().eq('id', data.id);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
});

/** PUT { id, rule, replies } → update everything. */
export const PUT = withErrorLog('admin', 'Instagram rule update', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(body?.id))) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const c = cleanAll(body);
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 });
  const db = createAdminClient();
  const { error } = await db.from('instagram_reply_rules').update(c.rule).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try { await saveReplies(db, body.id, c.replies); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  return NextResponse.json({ ok: true });
});

/** PATCH { id, is_active } | { order: [ids] } */
export const PATCH = withErrorLog('admin', 'Instagram rule toggle', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const b = await request.json().catch(() => ({}));
  const db = createAdminClient();
  if (Array.isArray(b.order)) {
    const ids = b.order.filter((x: any) => /^[0-9a-f-]{36}$/i.test(String(x)));
    await Promise.all(ids.map((id: string, i: number) => db.from('instagram_reply_rules').update({ position: i * 10 }).eq('id', id)));
    return NextResponse.json({ ok: true });
  }
  if (/^[0-9a-f-]{36}$/i.test(String(b.id)) && typeof b.is_active === 'boolean') {
    const { error } = await db.from('instagram_reply_rules').update({ is_active: b.is_active }).eq('id', b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Bad request' }, { status: 400 });
});

/** DELETE ?id= */
export const DELETE = withErrorLog('admin', 'Instagram rule delete', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const id = request.nextUrl.searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const { error } = await createAdminClient().from('instagram_reply_rules').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
