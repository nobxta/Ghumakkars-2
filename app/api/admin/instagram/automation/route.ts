import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { runInboxSync } from '@/lib/instagram-tracker/automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET → settings + saved replies. */
export const GET = withErrorLog('admin', 'Instagram automation get', async () => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const db = createAdminClient();
  const [cfg, tpl] = await Promise.all([
    db.from('instagram_automation').select('*').eq('id', 1).maybeSingle(),
    db.from('instagram_reply_templates').select('*').order('created_at', { ascending: true }),
  ]);
  return NextResponse.json({
    settings: cfg.data,
    templates: tpl.data || [],
    webhook: { configured: Boolean(process.env.INSTAGRAM_APP_SECRET && process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) },
  });
});

/**
 * PUT { dm_enabled?, dm_mode?, dm_cooldown_hours?, comment_enabled?, comment_mode?,
 *       comment_dm_enabled?, comment_posts_to_watch? }
 * Turning a switch on stamps *_enabled_at = now, so only NEW messages get answered.
 */
export const PUT = withErrorLog('admin', 'Instagram automation save', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const b = await request.json().catch(() => ({}));
  const db = createAdminClient();
  const { data: cur } = await db.from('instagram_automation').select('dm_enabled, comment_enabled').eq('id', 1).maybeSingle();

  const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.dm_enabled === 'boolean') {
    p.dm_enabled = b.dm_enabled;
    if (b.dm_enabled && !cur?.dm_enabled) p.dm_enabled_at = new Date().toISOString();
  }
  if (typeof b.comment_enabled === 'boolean') {
    p.comment_enabled = b.comment_enabled;
    if (b.comment_enabled && !cur?.comment_enabled) p.comment_enabled_at = new Date().toISOString();
  }
  if (typeof b.comment_dm_enabled === 'boolean') p.comment_dm_enabled = b.comment_dm_enabled;
  if (b.dm_mode === 'fixed' || b.dm_mode === 'random') p.dm_mode = b.dm_mode;
  if (b.comment_mode === 'fixed' || b.comment_mode === 'random') p.comment_mode = b.comment_mode;
  if (b.dm_cooldown_hours != null) p.dm_cooldown_hours = Math.min(720, Math.max(0, Math.round(Number(b.dm_cooldown_hours) || 0)));
  if (typeof b.site_url === 'string') {
    const u = b.site_url.trim().replace(/\/$/, '');
    if (u && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(u)) return NextResponse.json({ error: 'Website must be a full https:// address.' }, { status: 400 });
    p.site_url = u || null;
  }
  if (b.comment_posts_to_watch != null) p.comment_posts_to_watch = Math.min(25, Math.max(1, Math.round(Number(b.comment_posts_to_watch) || 10)));

  // Refuse to switch on with nothing to say.
  if (p.dm_enabled || p.comment_enabled) {
    const { data: r } = await db.from('instagram_reply_rules').select('channel').eq('is_active', true);
    const ch = new Set((r || []).map((x: any) => x.channel));
    if (p.dm_enabled && !ch.has('dm')) return NextResponse.json({ error: 'Create a message rule first.' }, { status: 400 });
    if (p.comment_enabled && !ch.has('comment')) return NextResponse.json({ error: 'Create a comment rule first.' }, { status: 400 });
  }

  const { error } = await db.from('instagram_automation').update(p).eq('id', 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

/** POST { resume? } → sync inbox now (and send any due auto replies). */
export const POST = withErrorLog('admin', 'Instagram sync now', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const b = await request.json().catch(() => ({}));
  if (b.resume) await createAdminClient().from('instagram_automation').update({ paused_until: null }).eq('id', 1);
  const s = await runInboxSync({ trigger: 'manual' });
  if (s.reason === 'locked') return NextResponse.json({ error: 'A sync is already running — try again in a moment.' }, { status: 409 });
  if (s.reason === 'paused') return NextResponse.json({ error: 'Paused after Instagram\'s rate limit.' }, { status: 429 });
  return NextResponse.json({ summary: s });
});
