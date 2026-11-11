/**
 * Instagram cron — one entry point for everything Instagram:
 *   • inbox sync + auto replies (every run)
 *   • follower tracker (only accounts that are due, default every 6h)
 *
 * Runs independently of the website. Schedule it every minute on the VPS:
 *
 *   * * * * * cd /path/to/app && npx tsx scripts/instagram-cron.ts >> logs/instagram.log 2>&1
 *
 * Or: npm run ig:cron
 */
import { existsSync } from 'fs';
import { runInboxSync, pruneInbox } from '../lib/instagram-tracker/automation';
import { runTracker } from '../lib/instagram-tracker/tracker';

for (const f of ['.env.local', '.env']) if (existsSync(f)) (process as any).loadEnvFile(f);

const stamp = () => new Date().toISOString();
const log = (m: string) => console.log(`[${stamp()}] ${m}`);

(async () => {
  let code = 0;
  try {
    const s = await runInboxSync({ trigger: 'cron', log });
    if (s.ran && (s.dmReplies || s.commentReplies || s.privateReplies || s.failed || s.error)) {
      log(`Inbox: ${s.dmReplies} DM, ${s.commentReplies} comment, ${s.privateReplies} private replies, ${s.failed} failed${s.error ? ` — ${s.error}` : ''}`);
    }
    if (s.reason === 'paused') log('Inbox: paused after rate limit');
  } catch (e: any) {
    code = 1;
    console.error(`[${stamp()}] Inbox sync crashed:`, e?.message || e);
  }

  try {
    const t = await runTracker({ trigger: 'cron', log });
    if (t.ran) log(`Followers: checked ${t.checked}, ok ${t.success}, failed ${t.failed}`);
  } catch (e: any) {
    code = 1;
    console.error(`[${stamp()}] Follower tracker crashed:`, e?.message || e);
  }

  // Housekeeping once a day around 03:00 UTC.
  const now = new Date();
  if (now.getUTCHours() === 3 && now.getUTCMinutes() === 0) await pruneInbox().catch(() => {});

  process.exit(code);
})();
