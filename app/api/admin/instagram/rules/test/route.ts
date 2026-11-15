import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { cleanReply, loadLiveTrips, siteUrlFrom, tripsFor, type ReplyRow } from '@/lib/instagram-tracker/messages';
import { sendReply } from '@/lib/instagram-tracker/automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST { reply, userId, username }   → send a draft reply to someone who messaged you in the last 24h
 * POST { previewTrips: options, message } → the trip cards a "trips" reply would send for that message right now
 *                                          (+ the {trip} name and whether the message named a trip)
 * POST { listTrips: true }           → live trips for the "pick trips" list
 */
export const POST = withErrorLog('admin', 'Instagram reply test', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const b = await request.json().catch(() => ({}));
  const db = createAdminClient();
  const { data: cfg } = await db.from('instagram_automation').select('site_url').eq('id', 1).maybeSingle();
  const siteUrl = siteUrlFrom(cfg?.site_url);

  if (b.listTrips) {
    const trips = await loadLiveTrips();
    return NextResponse.json({ trips: trips.map((t) => ({ id: t.id, title: t.title, place: (t.destination || '').split(',')[0], price: t.price, image: t.image, bookable: t.bookable, featured: t.featured })) });
  }
  if (b.previewTrips != null) {
    const options = typeof b.previewTrips === 'object' ? b.previewTrips : { trips_limit: Number(b.previewTrips) || 5 };
    const r = await tripsFor({ format: 'trips', options }, String(b.message || ''), siteUrl || 'https://example.com');
    return NextResponse.json({ cards: r.cards, tripName: r.tripName, matched: r.matched });
  }

  if (!/^\d+$/.test(String(b.userId))) return NextResponse.json({ error: 'Pick who to send the test to.' }, { status: 400 });
  const c = cleanReply(b.reply, 'dm');
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 });
  if (c.value.format === 'trips' && !/^https:\/\//.test(siteUrl)) {
    return NextResponse.json({ error: 'Set your website address (https://…) in Auto reply → Website first — trip buttons need it.' }, { status: 400 });
  }

  // Instagram only allows business messages within 24h of the person's last message.
  const { data: last } = await db.from('instagram_dm_messages').select('created_at').eq('user_id', String(b.userId)).eq('direction', 'in').order('created_at', { ascending: false }).limit(1);
  if (!last?.[0] || Date.now() - new Date(last[0].created_at).getTime() > 86_400_000) {
    return NextResponse.json({ error: 'They have not messaged you in the last 24 hours — Instagram will not deliver it.' }, { status: 400 });
  }

  try {
    const r = await sendReply({ id: String(b.userId) }, { id: 'test', rule_id: null, ...(c.value as any) } as ReplyRow, { username: b.username || null, message: String(b.message || '') }, siteUrl);
    return NextResponse.json({ ok: true, fellBack: r.fellBack });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Instagram refused the message' }, { status: 502 });
  }
});
