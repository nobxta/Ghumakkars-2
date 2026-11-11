import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { paidOf, owedOf } from '@/lib/booking-money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ActivityType = 'signup' | 'booking' | 'payment_pending' | 'payment_received' | 'payment_rejected' | 'cancelled';

interface ActivityEvent {
  id: string;
  type: ActivityType;
  at: string;
  title: string;
  meta: string;
  href: string;
  amount?: number;
  /** For payment_pending: everything the review popup needs. */
  approval?: Record<string, unknown>;
}

const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const nameOf = (p: any) => p?.full_name || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.email || 'Someone';
const day = (d?: string | null) => (d ? String(d).slice(0, 10) : null);

/**
 * GET /api/admin/activity — the admin "live" feed: recent sign-ups, bookings,
 * payments and cancellations (newest first), plus counts for the tab title.
 * Polled by the admin shell every ~15s; cheap, bounded queries only.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const limit = Math.min(60, Math.max(5, Number(new URL(req.url).searchParams.get('limit')) || 30));
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const admin = createAdminClient();

  const bookingMoney = 'id, user_id, trip_id, booking_status, number_of_participants, departure_date, payment_method, total_price, final_amount, coupon_discount, wallet_amount_used, waived_amount, addons_total, amount_paid, is_offline_booking, primary_passenger_name, primary_passenger_phone, primary_passenger_email';

  const [usersRes, bookingsRes, txnsRes, reviewedRes, cancelledRes, pendingCountRes] = await Promise.all([
    admin.from('profiles').select('id, full_name, first_name, last_name, email, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(limit),
    admin.from('bookings').select('id, booking_status, number_of_participants, primary_passenger_name, is_offline_booking, created_at, trips(title)').gte('created_at', since).order('created_at', { ascending: false }).limit(limit),
    admin.from('payment_transactions')
      .select(`id, amount, payment_status, payment_type, payment_mode, payment_method, transaction_id, created_at, booking_id, bookings(${bookingMoney}, trips(title, discounted_price, start_date), payment_transactions(amount, payment_status, amount_refunded))`)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(limit),
    admin.from('payment_transactions')
      .select('id, amount, payment_status, payment_reviewed_at, booking_id, bookings(primary_passenger_name, trips(title))')
      .in('payment_status', ['verified', 'rejected']).not('payment_reviewed_at', 'is', null)
      .gte('payment_reviewed_at', since).order('payment_reviewed_at', { ascending: false }).limit(limit),
    admin.from('bookings').select('id, primary_passenger_name, updated_at, trips(title)').eq('booking_status', 'cancelled').gte('updated_at', since).order('updated_at', { ascending: false }).limit(15),
    admin.from('payment_transactions').select('id, bookings!inner(booking_status)', { count: 'exact', head: true }).eq('payment_status', 'pending').not('bookings.booking_status', 'in', '(cancelled,rejected)'),
  ]);

  const events: ActivityEvent[] = [];

  (usersRes.data || []).forEach((u: any) =>
    events.push({ id: `u-${u.id}`, type: 'signup', at: u.created_at, title: `${nameOf(u)} signed up`, meta: u.email || 'New account', href: `/admin/users/${u.id}` }),
  );

  (bookingsRes.data || []).forEach((b: any) => {
    const trip = one<any>(b.trips)?.title || 'a trip';
    const pax = Number(b.number_of_participants) || 1;
    events.push({
      id: `b-${b.id}`, type: 'booking', at: b.created_at,
      title: `${b.primary_passenger_name || 'Someone'} booked ${trip}`,
      meta: `${pax} traveller${pax > 1 ? 's' : ''}${b.is_offline_booking ? ' · offline' : ''}`,
      href: `/admin/bookings/${b.id}`,
    });
  });

  (txnsRes.data || []).forEach((t: any) => {
    const b = one<any>(t.bookings);
    if (!b || ['cancelled', 'rejected'].includes(b.booking_status)) return;
    const trip = one<any>(b.trips);
    const name = b.primary_passenger_name || 'Customer';
    const amount = num(t.amount);
    const method = (t.payment_method || t.payment_mode || '').toString().toUpperCase();
    if (t.payment_status === 'pending') {
      events.push({
        id: `p-${t.id}`, type: 'payment_pending', at: t.created_at, amount,
        title: `${name} submitted ₹${Math.round(amount).toLocaleString('en-IN')}`,
        meta: `${trip?.title || 'Trip'}${method ? ` · ${method}` : ''} · needs review`,
        href: `/admin/bookings/${b.id}`,
        approval: {
          kind: 'approval', txnId: t.id, bookingId: b.id, amount, reference: t.transaction_id || null,
          method: t.payment_method || t.payment_mode || null, paymentType: t.payment_type || null, createdAt: t.created_at,
          name, phone: b.primary_passenger_phone || null, email: b.primary_passenger_email || null,
          trip: trip?.title || 'Trip', departure: day(b.departure_date || trip?.start_date),
          pax: Number(b.number_of_participants) || 1, bookingStatus: b.booking_status, owed: owedOf(b), paid: paidOf(b),
        },
      });
    } else if (t.payment_status === 'verified') {
      // Online (gateway) payments arrive already verified.
      events.push({
        id: `r-${t.id}`, type: 'payment_received', at: t.created_at, amount,
        title: `₹${Math.round(amount).toLocaleString('en-IN')} received from ${name}`,
        meta: `${trip?.title || 'Trip'}${method ? ` · ${method}` : ''}`,
        href: `/admin/bookings/${b.id}`,
      });
    }
  });

  // Manual reviews (approve / reject) — skip ones already shown as received at creation.
  const seen = new Set(events.map((e) => e.id));
  (reviewedRes.data || []).forEach((t: any) => {
    if (seen.has(`r-${t.id}`)) return;
    const b = one<any>(t.bookings);
    const name = b?.primary_passenger_name || 'Customer';
    const amount = num(t.amount);
    const ok = t.payment_status === 'verified';
    events.push({
      id: `${ok ? 'v' : 'x'}-${t.id}`, type: ok ? 'payment_received' : 'payment_rejected', at: t.payment_reviewed_at, amount,
      title: ok ? `₹${Math.round(amount).toLocaleString('en-IN')} verified for ${name}` : `Payment from ${name} rejected`,
      meta: one<any>(b?.trips)?.title || 'Trip',
      href: `/admin/bookings/${t.booking_id}`,
    });
  });

  (cancelledRes.data || []).forEach((b: any) =>
    events.push({
      id: `c-${b.id}`, type: 'cancelled', at: b.updated_at,
      title: `${b.primary_passenger_name || 'A booking'} cancelled`,
      meta: one<any>(b.trips)?.title || 'Trip', href: `/admin/bookings/${b.id}`,
    }),
  );

  events.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    pendingReview: pendingCountRes.count ?? events.filter((e) => e.type === 'payment_pending').length,
    events: events.slice(0, limit),
  });
}
