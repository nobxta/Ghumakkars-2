import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { runInboxSync } from '@/lib/instagram-tracker/automation';
import { logError } from '@/lib/error-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Instagram webhook (Meta App Dashboard → Webhooks → Instagram → callback URL).
 *
 * Why it exists: Instagram only lets an app answer a DM if the app received that
 * message through its webhook — without this, every auto DM fails with
 * "(#10) This message is sent outside of allowed window".
 * Bonus: a new DM/comment triggers an inbox sync at once, so replies go out in
 * seconds instead of waiting for the next minute's cron run.
 *
 * Env: INSTAGRAM_WEBHOOK_VERIFY_TOKEN (any random string, also typed into Meta)
 *      INSTAGRAM_APP_SECRET           App secret(s): Meta app secret and/or Instagram app secret, comma-separated
 */

/** GET → Meta's one-time verification handshake. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '';
  if (sp.get('hub.mode') === 'subscribe' && expected && sp.get('hub.verify_token') === expected) {
    return new NextResponse(sp.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

let lastKick = 0;

/** POST → events. Verify the signature, acknowledge fast, sync in the background. */
export async function POST(request: NextRequest) {
  const secret = process.env.INSTAGRAM_APP_SECRET || '';
  const raw = await request.text();
  if (!secret) {
    await logError({ category: 'webhook', process: 'Instagram webhook', message: 'INSTAGRAM_APP_SECRET is not set — event ignored', level: 'warning' });
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  // Unified-login apps may sign with the Meta app secret or the Instagram app secret:
  // INSTAGRAM_APP_SECRET may hold both, comma-separated.
  const sig = request.headers.get('x-hub-signature-256') || '';
  const ok = secret.split(',').map((x) => x.trim()).filter(Boolean).some((key) => {
    const want = `sha256=${crypto.createHmac('sha256', key).update(raw, 'utf8').digest('hex')}`;
    return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
  });
  if (!ok) return NextResponse.json({ error: 'Bad signature' }, { status: 401 });

  let body: any = null;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  // Anything a person did: a message (not our own echo), a postback/quick reply, or a comment.
  const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];
  const relevant = entries.some((e) =>
    (Array.isArray(e?.messaging) && e.messaging.some((m: any) => (m?.message && !m.message.is_echo) || m?.postback)) ||
    (Array.isArray(e?.changes) && e.changes.some((c: any) => c?.field === 'comments' || c?.field === 'messages')));

  const db = createAdminClient();
  await db.from('instagram_automation').update({ webhook_last_at: new Date().toISOString() }).eq('id', 1);

  // Kick a sync (at most every 3s). The run lock prevents overlap with cron.
  if (relevant && Date.now() - lastKick > 3000) {
    lastKick = Date.now();
    setTimeout(() => {
      runInboxSync({ trigger: 'manual' }).catch((e) => logError({ category: 'webhook', process: 'Instagram webhook sync', error: e }));
    }, 1500); // give Instagram a moment so the Conversations API already shows the message
  }
  return NextResponse.json({ ok: true });
}
