import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { runTracker } from '@/lib/instagram-tracker/tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST { accountId?, resume? } → "Check now".
 * - accountId: check one account (ignores its schedule)
 * - no accountId: check every active account
 * - resume: clear a rate-limit pause first (use after waiting it out)
 */
export const POST = withErrorLog('admin', 'Instagram check now', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({}));
  const db = createAdminClient();

  if (body.resume) {
    await db.from('instagram_tracker_state').update({ rate_limited_until: null, updated_at: new Date().toISOString() }).eq('id', 1);
  }

  let ids: string[];
  if (typeof body.accountId === 'string' && /^[0-9a-f-]{36}$/i.test(body.accountId)) {
    ids = [body.accountId];
  } else {
    const { data } = await db.from('instagram_accounts').select('id').eq('is_active', true);
    ids = (data || []).map((a: any) => a.id);
  }
  if (!ids.length) return NextResponse.json({ error: 'No active accounts to check.' }, { status: 400 });

  const run = await runTracker({ trigger: 'manual', accountIds: ids });
  if (run.reason === 'locked') return NextResponse.json({ error: 'A check is already running — try again in a minute.', run }, { status: 409 });
  if (run.reason === 'rate_limited') return NextResponse.json({ error: 'Paused after hitting Instagram\'s rate limit.', run }, { status: 429 });
  if (run.reason === 'not_configured') return NextResponse.json({ error: 'Instagram token is not configured on the server.', run }, { status: 503 });
  return NextResponse.json({ run });
});
