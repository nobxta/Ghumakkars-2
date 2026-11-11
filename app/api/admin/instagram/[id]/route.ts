import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { buckets, DAY_MS, type Snap } from '@/lib/instagram-tracker/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** GET ?range=7|30|90|365|all → history for one account. */
export const GET = withErrorLog('admin', 'Instagram account history', async (request: NextRequest, { params }: Ctx) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const range = request.nextUrl.searchParams.get('range') || '30';
  const days = range === 'all' ? null : Math.min(3650, Math.max(1, Number(range) || 30));
  const db = createAdminClient();

  let q = db.from('instagram_snapshots').select('followers_count, follows_count, media_count, source, captured_at').eq('account_id', params.id).order('captured_at', { ascending: true }).limit(20000);
  if (days) q = q.gte('captured_at', new Date(Date.now() - days * DAY_MS).toISOString());

  const [snapRes, baseRes, logRes] = await Promise.all([
    q,
    // The last value before the window, so the first day's net change is real.
    days
      ? db.from('instagram_snapshots').select('followers_count, captured_at').eq('account_id', params.id).lt('captured_at', new Date(Date.now() - days * DAY_MS).toISOString()).order('captured_at', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as any[] }),
    db.from('instagram_fetch_log').select('*').eq('account_id', params.id).order('created_at', { ascending: false }).limit(30),
  ]);
  if (snapRes.error) return NextResponse.json({ error: snapRes.error.message }, { status: 500 });

  const snaps = (snapRes.data || []) as Snap[];
  const withBase = [...((baseRes.data || []) as Snap[]), ...snaps];
  const strip = (b: ReturnType<typeof buckets>) => (baseRes.data?.length ? b.slice(1) : b);

  return NextResponse.json({
    snapshots: snaps,
    daily: strip(buckets(withBase, 'day')),
    weekly: strip(buckets(withBase, 'week')),
    monthly: strip(buckets(withBase, 'month')),
    log: logRes.data || [],
  });
});

/** PATCH { is_active?, check_interval_hours?, notes? } */
export const PATCH = withErrorLog('admin', 'Instagram update account', async (request: NextRequest, { params }: Ctx) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.is_active === 'boolean') {
    patch.is_active = body.is_active;
    if (body.is_active) { patch.next_check_at = new Date().toISOString(); patch.consecutive_failures = 0; }
  }
  if (body.check_interval_hours != null) patch.check_interval_hours = Math.min(168, Math.max(1, Math.round(Number(body.check_interval_hours) || 6)));
  if (typeof body.notes === 'string') patch.notes = body.notes.slice(0, 500) || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { error } = await createAdminClient().from('instagram_accounts').update(patch).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

/** DELETE → stop tracking and remove all history for the account. */
export const DELETE = withErrorLog('admin', 'Instagram delete account', async (_req: NextRequest, { params }: Ctx) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const { error } = await createAdminClient().from('instagram_accounts').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

/** POST { followers, follows?, media? } → manual snapshot (e.g. back-fill a known number). */
export const POST = withErrorLog('admin', 'Instagram manual snapshot', async (request: NextRequest, { params }: Ctx) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const followers = Math.round(Number(body.followers));
  if (!Number.isFinite(followers) || followers < 0) return NextResponse.json({ error: 'Enter a follower count.' }, { status: 400 });
  const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
  const at = body.at && !Number.isNaN(Date.parse(body.at)) ? new Date(body.at).toISOString() : new Date().toISOString();
  if (Date.parse(at) > Date.now() + 60_000) return NextResponse.json({ error: 'Date cannot be in the future.' }, { status: 400 });

  const db = createAdminClient();
  const { data: acc } = await db.from('instagram_accounts').select('id, username, last_success_at').eq('id', params.id).maybeSingle();
  if (!acc) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const { error } = await db.from('instagram_snapshots').insert({ account_id: acc.id, followers_count: followers, follows_count: num(body.follows), media_count: num(body.media), source: 'manual', captured_at: at });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Only move the headline number if this is the newest data point.
  if (!acc.last_success_at || Date.parse(at) >= Date.parse(acc.last_success_at)) {
    await db.from('instagram_accounts').update({ followers_count: followers, last_success_at: at }).eq('id', acc.id);
  }
  return NextResponse.json({ ok: true });
});
