import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { cached, getAccountTotals, getDemographics, getFollowerSeries, getMedia, getMediaInsights, getProfile, IgApiError } from '@/lib/instagram-tracker/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL = 10 * 60_000;

/**
 * GET ?part=overview|media&refresh=1
 * overview → profile, 1/7/30-day totals, daily new followers, demographics
 * media    → last 24 posts with per-post insights
 * Cached 10 min in memory so the page stays fast and the API quota stays low.
 */
export const GET = withErrorLog('admin', 'Instagram insights', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const sp = request.nextUrl.searchParams;
  const force = sp.get('refresh') === '1';
  const part = sp.get('part') || 'overview';

  try {
    if (part === 'media') {
      const data = await cached('ig:media', TTL, async () => {
        const media = await getMedia(24);
        const ins = await getMediaInsights(media);
        return { fetchedAt: new Date().toISOString(), media: media.map((m) => ({ ...m, insights: ins[m.id] || {} })) };
      }, force);
      return NextResponse.json(data);
    }

    const data = await cached('ig:overview', TTL, async () => {
      const [profile, day, week, month, followers, demographics, pDay, pWeek, pMonth] = await Promise.all([
        getProfile(),
        getAccountTotals(1),
        getAccountTotals(7),
        getAccountTotals(30),
        getFollowerSeries(30),
        getDemographics().catch(() => ({})),
        // Same-length window just before, for "vs previous period" deltas.
        getAccountTotals(1, 1).catch(() => ({})),
        getAccountTotals(7, 7).catch(() => ({})),
        getAccountTotals(30, 30).catch(() => ({})),
      ]);
      return {
        fetchedAt: new Date().toISOString(), profile,
        totals: { day, week, month }, previous: { day: pDay, week: pWeek, month: pMonth },
        followers, demographics,
      };
    }, force);
    return NextResponse.json(data);
  } catch (e: any) {
    const status = e instanceof IgApiError ? (e.kind === 'rate_limited' ? 429 : e.kind === 'auth_error' ? 503 : 502) : 500;
    return NextResponse.json({ error: e.message || 'Instagram request failed', kind: e.kind || 'failed' }, { status });
  }
});
