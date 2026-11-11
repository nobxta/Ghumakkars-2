import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { igConfig, normaliseUsername, USERNAME_RE } from '@/lib/instagram-tracker/graph';
import { runTracker } from '@/lib/instagram-tracker/tracker';
import { buckets, growthSince, istDay, DAY_MS, type Snap } from '@/lib/instagram-tracker/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET → overview: accounts with growth, tracker state, recent attempts. */
export const GET = withErrorLog('admin', 'Instagram overview', async () => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const db = createAdminClient();

  const since = new Date(Date.now() - 32 * DAY_MS).toISOString();
  const [accRes, snapRes, oldRes, stateRes, logRes, failRes] = await Promise.all([
    db.from('instagram_accounts').select('*').order('created_at', { ascending: true }),
    db.from('instagram_snapshots').select('account_id, followers_count, captured_at').gte('captured_at', since).order('captured_at', { ascending: true }).limit(20000),
    // Earliest snapshot per account (to know how far history goes) — small table scan is fine.
    db.from('instagram_snapshots').select('account_id, captured_at').order('captured_at', { ascending: true }).limit(5000),
    db.from('instagram_tracker_state').select('*').eq('id', 1).maybeSingle(),
    db.from('instagram_fetch_log').select('*').order('created_at', { ascending: false }).limit(40),
    db.from('instagram_fetch_log').select('id', { count: 'exact', head: true }).neq('status', 'success').gte('created_at', new Date(Date.now() - DAY_MS).toISOString()),
  ]);
  if (accRes.error) return NextResponse.json({ error: accRes.error.message }, { status: 500 });

  const byAcc = new Map<string, Snap[]>();
  (snapRes.data || []).forEach((s: any) => {
    const list = byAcc.get(s.account_id) || [];
    list.push(s);
    byAcc.set(s.account_id, list);
  });
  const firstSeen = new Map<string, string>();
  (oldRes.data || []).forEach((s: any) => { if (!firstSeen.has(s.account_id)) firstSeen.set(s.account_id, s.captured_at); });

  const now = Date.now();
  const todayStart = new Date(`${istDay(new Date().toISOString())}T00:00:00+05:30`).getTime();

  const accounts = (accRes.data || []).map((a: any) => {
    const snaps = byAcc.get(a.id) || [];
    // If history starts before the 32-day window, growth for 30d is complete.
    const first = firstSeen.get(a.id);
    const g = (ms: number) => {
      const r = growthSince(snaps, a.followers_count, ms);
      return { ...r, partial: r.partial && !(first && new Date(first).getTime() <= ms) };
    };
    return {
      ...a,
      growth: {
        today: g(todayStart),
        day: g(now - DAY_MS),
        week: g(now - 7 * DAY_MS),
        month: g(now - 30 * DAY_MS),
      },
      spark: buckets(snaps, 'day').slice(-30).map((b) => b.close),
      tracking_since: first || null,
    };
  });

  const cfg = igConfig();
  return NextResponse.json({
    configured: cfg.configured,
    state: stateRes.data || null,
    accounts,
    log: logRes.data || [],
    failures24h: failRes.count || 0,
  });
});

/** POST { username, interval? } → start tracking and fetch immediately. */
export const POST = withErrorLog('admin', 'Instagram add account', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({}));
  const username = normaliseUsername(body.username);
  const interval = Math.min(168, Math.max(1, Math.round(Number(body.interval) || 6)));
  if (!USERNAME_RE.test(username)) return NextResponse.json({ error: 'Enter a valid Instagram username.' }, { status: 400 });

  const db = createAdminClient();
  const { data: existing } = await db.from('instagram_accounts').select('id').eq('username', username).maybeSingle();
  if (existing) return NextResponse.json({ error: `@${username} is already being tracked.` }, { status: 409 });

  const { data: acc, error } = await db.from('instagram_accounts').insert({ username, check_interval_hours: interval }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const run = await runTracker({ trigger: 'manual', accountIds: [acc.id] });
  return NextResponse.json({ id: acc.id, username, run });
});
