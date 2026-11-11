import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { moneyOf } from '@/lib/booking-money';
import { effectiveBookingStatus } from '@/lib/booking-status-labels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Analytics feed. Returns slim, PII-free records for every booking, payment,
 * user, trip and referral; the analytics page aggregates them client-side so
 * date-range, trip filter, granularity and comparison changes are instant.
 *
 * Money uses the same rules as the dashboard/bookings pages (lib/booking-money):
 * "collected" = verified ledger minus refunds on our own bookings; referred
 * (partner) bookings contribute only their commission.
 */
const n = (v: unknown) => {
  const x = parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
};

const norm = (s?: string | null) => (s || '').trim().replace(/\s+/g, ' ');

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const [tripsRes, bookingsRes, usersRes, referralsRes] = await Promise.all([
    admin
      .from('trips')
      .select('id, title, destination, discounted_price, original_price, max_participants, start_date, end_date, is_recurring, is_active, status, created_at, duration_days'),
    admin
      .from('bookings')
      .select(
        'id, trip_id, user_id, booking_status, number_of_participants, departure_date, payment_method, payment_mode, total_price, final_amount, coupon_code, coupon_discount, wallet_amount_used, waived_amount, addons_total, amount_paid, referral_partner, referral_commission, is_offline_booking, college, primary_passenger_gender, pickup_point, created_at, trips(discounted_price, start_date, end_date), payment_transactions(id, amount, payment_status, amount_refunded, payment_method, payment_mode, payment_type, upi_provider, card_network, created_at, paid_at)',
      )
      .limit(20000),
    admin.from('profiles').select('id, created_at, email_verified, college_name, university, gender, referred_by, role').limit(50000),
    admin.from('referrals').select('id, created_at, reward_status, reward_amount, credited_at, first_booking_id').limit(20000),
  ]);

  const err = tripsRes.error || bookingsRes.error || usersRes.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const trips = (tripsRes.data || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    destination: norm(t.destination) || 'Unknown',
    price: n(t.discounted_price),
    originalPrice: n(t.original_price),
    capacity: Number(t.max_participants) || 0,
    start: t.start_date,
    end: t.end_date,
    recurring: !!t.is_recurring,
    active: t.is_active !== false && t.status !== 'cancelled',
    status: t.status || (t.is_active ? 'active' : 'inactive'),
    createdAt: t.created_at,
  }));

  const payments: any[] = [];
  const bookings = (bookingsRes.data || []).map((b: any) => {
    const trip = Array.isArray(b.trips) ? b.trips[0] : b.trips;
    const m = moneyOf(b);
    const partner = b.booking_status === 'referred';
    const dep = b.departure_date || trip?.start_date || null;
    (b.payment_transactions || []).forEach((t: any) => {
      payments.push({
        id: t.id,
        bookingId: b.id,
        tripId: b.trip_id,
        amount: n(t.amount),
        refunded: n(t.amount_refunded),
        status: t.payment_status || 'pending',
        method: (t.payment_method || (t.payment_mode === 'manual' ? 'manual' : t.payment_mode) || 'other').toLowerCase(),
        // Channel: how the money reached us, independent of instrument.
        mode: t.payment_type === 'offline' ? 'offline' : t.payment_mode === 'razorpay' ? 'gateway' : t.payment_mode === 'manual' ? 'manual' : (t.payment_mode || 'other').toLowerCase(),
        type: t.payment_type || null,
        upi: t.upi_provider || null,
        network: t.card_network || null,
        partner,
        at: t.paid_at || t.created_at,
      });
    });
    // Legacy offline bookings have no ledger rows — mirror paidOf() and count
    // their amount_paid as one cash payment on the booking date.
    if (!partner && (b.payment_transactions || []).length === 0 && (b.is_offline_booking || !b.user_id) && n(b.amount_paid) > 0) {
      payments.push({
        id: `legacy-${b.id}`, bookingId: b.id, tripId: b.trip_id, amount: n(b.amount_paid), refunded: 0,
        status: 'verified', method: 'cash', mode: 'offline', type: null, upi: null, network: null, partner, at: b.created_at,
      });
    }
    return {
      id: b.id,
      tripId: b.trip_id,
      userId: b.user_id,
      status: b.booking_status || 'pending',
      effStatus: effectiveBookingStatus(b.booking_status, dep, b.departure_date ? b.departure_date : trip?.end_date),
      pax: Number(b.number_of_participants) || 1,
      departure: dep,
      method: b.payment_method || 'full',
      mode: b.payment_mode || 'online',
      offline: !!b.is_offline_booking,
      coupon: b.coupon_code ? String(b.coupon_code).toUpperCase() : null,
      couponDiscount: n(b.coupon_discount),
      walletUsed: n(b.wallet_amount_used),
      waived: m.waived,
      addons: m.addonsTotal,
      owed: partner ? 0 : m.owed,
      paid: partner ? 0 : m.paid,
      refunded: m.refunded,
      remaining: partner ? 0 : m.remaining,
      payStatus: partner ? 'partner' : m.status,
      partner: partner ? norm(b.referral_partner) || 'Partner' : null,
      commission: partner ? n(b.referral_commission) : 0,
      college: norm(b.college) || null,
      gender: (b.primary_passenger_gender || '').toLowerCase() || null,
      pickup: norm(b.pickup_point) || null,
      createdAt: b.created_at,
    };
  });

  const users = (usersRes.data || [])
    .filter((u: any) => u.role !== 'admin')
    .map((u: any) => ({
      id: u.id,
      createdAt: u.created_at,
      verified: !!u.email_verified,
      college: norm(u.college_name || u.university) || null,
      gender: (u.gender || '').toLowerCase() || null,
      referred: !!u.referred_by,
    }));

  const referrals = (referralsRes.data || []).map((r: any) => ({
    id: r.id,
    createdAt: r.created_at,
    status: r.reward_status || 'pending',
    reward: n(r.reward_amount),
    creditedAt: r.credited_at,
    converted: !!r.first_booking_id,
  }));

  return NextResponse.json(
    { generatedAt: new Date().toISOString(), trips, bookings, payments, users, referrals },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
