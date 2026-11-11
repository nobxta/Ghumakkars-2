import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchIgProfile, igConfig, type IgResult } from './graph';

/**
 * One tracker run: picks accounts that are due, fetches them one by one and
 * stores snapshots + a log row per attempt. Safe to call from cron and from
 * the admin "Check now" button at the same time — a DB lock lets only one run.
 *
 * Failure handling
 * - rate limited  → stop the run, pause ALL checks (Meta's estimate or 1h, doubling)
 * - token problem → stop the run, flag token_error (shown as a banner in admin)
 * - not found     → retry that account in 24h
 * - other errors  → per-account exponential back-off (15m, 30m, 1h … ≤ interval)
 */

export interface RunOptions {
  trigger: 'cron' | 'manual';
  /** Only check these accounts (ignores their schedule). */
  accountIds?: string[];
  /** Max accounts per run, so one run never hammers the API. */
  limit?: number;
  log?: (msg: string) => void;
}

export interface RunSummary {
  ran: boolean;
  reason?: 'locked' | 'rate_limited' | 'not_configured' | 'nothing_due';
  checked: number;
  success: number;
  failed: number;
  stoppedBy?: 'rate_limited' | 'auth_error';
  pausedUntil?: string | null;
  results: { username: string; status: string; followers?: number; message?: string }[];
}

const LOCK_SECONDS = 10 * 60;
const GAP_MS = 1500;
const USAGE_SOFT_LIMIT = 85; // % — pause before Meta starts rejecting calls
const LOG_RETENTION_DAYS = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const addMin = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

export async function runTracker(opts: RunOptions): Promise<RunSummary> {
  const log = opts.log || (() => {});
  const db = createAdminClient();
  const summary: RunSummary = { ran: false, checked: 0, success: 0, failed: 0, results: [] };

  if (!igConfig().configured) {
    summary.reason = 'not_configured';
    await db.from('instagram_tracker_state').update({ token_error: 'INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID are not set on the server.', updated_at: new Date().toISOString() }).eq('id', 1);
    return summary;
  }

  const { data: state } = await db.from('instagram_tracker_state').select('*').eq('id', 1).maybeSingle();
  if (state?.rate_limited_until && new Date(state.rate_limited_until).getTime() > Date.now()) {
    summary.reason = 'rate_limited';
    summary.pausedUntil = state.rate_limited_until;
    log(`Paused by rate limit until ${state.rate_limited_until}`);
    return summary;
  }

  const owner = `${opts.trigger}:${randomUUID().slice(0, 8)}`;
  const { data: locked, error: lockErr } = await db.rpc('instagram_tracker_acquire_lock', { p_owner: owner, p_seconds: LOCK_SECONDS });
  if (lockErr) throw new Error(`Could not take tracker lock: ${lockErr.message}`);
  if (!locked) {
    summary.reason = 'locked';
    log('Another run is in progress — skipping.');
    return summary;
  }

  try {
    let q = db
      .from('instagram_accounts')
      .select('id, username, check_interval_hours, consecutive_failures')
      .order('next_check_at', { ascending: true })
      .limit(opts.limit ?? 40);
    q = opts.accountIds?.length
      ? q.in('id', opts.accountIds)
      : q.eq('is_active', true).lte('next_check_at', new Date().toISOString());
    const { data: accounts, error } = await q;
    if (error) throw new Error(error.message);

    if (!accounts?.length) {
      summary.reason = 'nothing_due';
      return summary;
    }
    summary.ran = true;

    let rateLimitStreak = Number((state?.last_run_summary as any)?.rateLimitStreak) || 0;
    let sawSuccess = false;

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      if (i > 0) await sleep(GAP_MS + Math.random() * 500);

      const started = Date.now();
      const res: IgResult = await fetchIgProfile(acc.username);
      const duration = Date.now() - started;
      const now = new Date().toISOString();
      summary.checked++;

      if (res.ok) {
        const p = res.profile;
        sawSuccess = true;
        summary.success++;
        summary.results.push({ username: acc.username, status: 'success', followers: p.followers });
        log(`✓ @${acc.username}: ${p.followers.toLocaleString('en-IN')} followers`);
        await db.from('instagram_snapshots').insert({ account_id: acc.id, followers_count: p.followers, follows_count: p.follows, media_count: p.media, source: 'api', captured_at: now });
        await db.from('instagram_accounts').update({
          followers_count: p.followers, follows_count: p.follows, media_count: p.media,
          display_name: p.name, profile_picture_url: p.picture,
          last_checked_at: now, last_success_at: now,
          next_check_at: addMin(acc.check_interval_hours * 60),
          consecutive_failures: 0, last_error: null,
        }).eq('id', acc.id);
        await db.from('instagram_fetch_log').insert({ account_id: acc.id, username: acc.username, status: 'success', trigger: opts.trigger, followers_count: p.followers, duration_ms: duration });

        if (res.usagePct >= USAGE_SOFT_LIMIT) {
          // Back off before Meta blocks us.
          const until = addMin(60);
          await db.from('instagram_tracker_state').update({ rate_limited_until: until }).eq('id', 1);
          summary.stoppedBy = 'rate_limited';
          summary.pausedUntil = until;
          log(`API usage at ${res.usagePct}% — pausing until ${until}`);
          break;
        }
        continue;
      }

      // (strict mode is off, so narrow the union explicitly)
      const fail = res as Extract<IgResult, { ok: false }>;
      summary.failed++;
      summary.results.push({ username: acc.username, status: fail.kind, message: fail.message });
      log(`✗ @${acc.username}: ${fail.kind} (${fail.code}) ${fail.message}`);
      await db.from('instagram_fetch_log').insert({ account_id: acc.id, username: acc.username, status: fail.kind, trigger: opts.trigger, error_code: fail.code, message: fail.message, duration_ms: duration });

      if (fail.kind === 'rate_limited') {
        rateLimitStreak++;
        const waitMin = Math.min(24 * 60, Math.max(fail.retryAfterMin ?? 0, 60 * 2 ** (rateLimitStreak - 1)));
        const until = addMin(waitMin);
        await db.from('instagram_accounts').update({ last_checked_at: now, last_error: fail.message, next_check_at: until }).eq('id', acc.id);
        await db.from('instagram_tracker_state').update({ rate_limited_until: until }).eq('id', 1);
        summary.stoppedBy = 'rate_limited';
        summary.pausedUntil = until;
        break;
      }

      if (fail.kind === 'auth_error') {
        await db.from('instagram_accounts').update({ last_checked_at: now, last_error: fail.message }).eq('id', acc.id);
        await db.from('instagram_tracker_state').update({ token_error: `${fail.message} (code ${fail.code})` }).eq('id', 1);
        summary.stoppedBy = 'auth_error';
        break;
      }

      const failures = (acc.consecutive_failures || 0) + 1;
      const retryMin = fail.kind === 'not_found'
        ? 24 * 60
        : Math.min(acc.check_interval_hours * 60, 15 * 2 ** (failures - 1));
      await db.from('instagram_accounts').update({
        last_checked_at: now, last_error: fail.message, consecutive_failures: failures, next_check_at: addMin(retryMin),
      }).eq('id', acc.id);
    }

    const stateUpdate: Record<string, unknown> = {
      last_run_at: new Date().toISOString(),
      last_run_summary: {
        trigger: opts.trigger, checked: summary.checked, success: summary.success, failed: summary.failed,
        stoppedBy: summary.stoppedBy || null, rateLimitStreak: summary.stoppedBy === 'rate_limited' ? rateLimitStreak : 0,
      },
      updated_at: new Date().toISOString(),
    };
    if (sawSuccess && summary.stoppedBy !== 'auth_error') stateUpdate.token_error = null;
    await db.from('instagram_tracker_state').update(stateUpdate).eq('id', 1);

    // Housekeeping: keep the attempt log bounded (snapshots are kept forever).
    if (opts.trigger === 'cron') {
      await db.from('instagram_fetch_log').delete().lt('created_at', new Date(Date.now() - LOG_RETENTION_DAYS * 86_400_000).toISOString());
    }
    return summary;
  } finally {
    await db.rpc('instagram_tracker_release_lock', { p_owner: owner });
  }
}
