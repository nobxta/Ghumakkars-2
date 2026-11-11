/**
 * Instagram follower tracker — cron entry point.
 *
 * Runs independently of the website (the Next.js server does not need to be up).
 * Each account is checked on its own schedule (default every 6 hours); running
 * this more often only picks up accounts that are due, so schedule it every 30 min:
 *
 *   0,30 * * * * cd /path/to/app && npx tsx scripts/instagram-track.ts >> logs/instagram-track.log 2>&1
 *
 * Or: npm run ig:track
 */
import { existsSync } from 'fs';
import { runTracker } from '../lib/instagram-tracker/tracker';

// Env is read when the run starts, so loading it here (after imports) is fine.
// Node's built-in loader never overrides variables already set by the environment.
for (const f of ['.env.local', '.env']) if (existsSync(f)) (process as any).loadEnvFile(f);

const stamp = () => new Date().toISOString();

runTracker({ trigger: 'cron', log: (m) => console.log(`[${stamp()}] ${m}`) })
  .then((s) => {
    const tail = s.ran
      ? `checked ${s.checked}, ok ${s.success}, failed ${s.failed}${s.stoppedBy ? `, stopped: ${s.stoppedBy}` : ''}`
      : `nothing run (${s.reason})${s.pausedUntil ? ` until ${s.pausedUntil}` : ''}`;
    console.log(`[${stamp()}] Instagram tracker: ${tail}`);
    process.exit(s.stoppedBy === 'auth_error' || s.reason === 'not_configured' ? 2 : 0);
  })
  .catch((e) => {
    console.error(`[${stamp()}] Instagram tracker crashed:`, e?.message || e);
    process.exit(1);
  });
