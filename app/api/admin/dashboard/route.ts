import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { paidOf, owedOf as fullOf } from '@/lib/booking-money';

export const runtime = 'nodejs';

const isActive = (b: any) => !['cancelled', 'rejected'].includes(b.booking_status);
// Revenue rule: a referred booking earns our commission/profit, NOT the trip
// collection (we settle the trip amount with the partner). Everyone else earns the
// cash actually collected.
const revenueOf = (b: any): number =>
  b.booking_status === 'referred' ? parseFloat(String(b.referral_commission || 0)) || 0 : paidOf(b);

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const weekAgoIso = new Date(today.getTime() - 7 * 86400000).toISOString();

  // Selected period (defaults to last 30 days). Scopes "activity" metrics.
  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const rangeStart = fromParam ? new Date(fromParam) : new Date(today.getTime() - 30 * 86400000);
  if (Number.isNaN(rangeStart.getTime())) rangeStart.setTime(today.getTime() - 30 * 86400000);
  const rangeEnd = toParam ? new Date(toParam) : new Date();
  if (Number.isNaN(rangeEnd.getTime())) rangeEnd.setTime(Date.now());
  rangeEnd.setHours(23, 59, 59, 999);
  const inRange = (iso?: string) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= rangeStart.getTime() && t <= rangeEnd.getTime(); };

  const [usersCountRes, verifiedCountRes, usersTodayRes, usersRangeRes, adminProfileRes, tripsRes, bookingsRes] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('email_verified', true),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayIso),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', rangeStart.toISOString()).lte('created_at', rangeEnd.toISOString()),
    admin.from('profiles').select('first_name').eq('id', auth.user.id).single(),
    admin.from('trips')
      .select('id, title, destination, discounted_price, max_participants, start_date, end_date, is_recurring, recurrence_day, duration_days, is_active, status, cover_image_url, image_url')
      .order('start_date', { ascending: true }),
    admin.from('bookings')
      .select('id, trip_id, booking_status, number_of_participants, departure_date, payment_method, total_price, final_amount, coupon_discount, wallet_amount_used, waived_amount, amount_paid, referral_commission, is_offline_booking, user_id, created_at, trips(discounted_price), payment_transactions(amount, payment_status, amount_refunded, created_at)')
      .limit(10000),
  ]);

  const tripsData = tripsRes.data || [];
  const bookings = bookingsRes.data || [];
  const active = bookings.filter(isActive);

  const collected = active.reduce((s, b) => s + revenueOf(b), 0);
  // Referred bookings have no outstanding balance owed to us (the customer settles
  // the trip cost; we only book the commission).
  const outstanding = active.reduce((s, b) => s + (b.booking_status === 'referred' ? 0 : Math.max(0, fullOf(b) - paidOf(b))), 0);
  const confirmed = bookings.filter((b: any) => b.booking_status === 'confirmed').length;
  const seatLocked = bookings.filter((b: any) => b.booking_status === 'seat_locked').length;
  const pending = bookings.filter((b: any) => b.booking_status === 'pending').length;
  const SEATED = ['confirmed', 'seat_locked', 'on_trip', 'completed', 'referred'];
  const travellers = active
    .filter((b: any) => SEATED.includes(b.booking_status))
    .reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0);

  const perTrip = new Map<string, { pax: number; collected: number; pending: number }>();
  active.forEach((b: any) => {
    if (!b.trip_id) return;
    const g = perTrip.get(b.trip_id) || { pax: 0, collected: 0, pending: 0 };
    if (SEATED.includes(b.booking_status)) g.pax += Number(b.number_of_participants) || 1;
    g.collected += revenueOf(b);
    g.pending += b.booking_status === 'referred' ? 0 : Math.max(0, fullOf(b) - paidOf(b));
    perTrip.set(b.trip_id, g);
  });

  const upcomingTrips = tripsData
    .filter((t: any) => t.is_active !== false && t.status !== 'cancelled' && t.status !== 'completed')
    .filter((t: any) => t.is_recurring || !t.end_date || new Date(t.end_date) >= today)
    .map((t: any) => ({
      id: t.id, title: t.title, destination: t.destination, max_participants: t.max_participants,
      start_date: t.start_date, is_recurring: t.is_recurring, recurrence_day: t.recurrence_day,
      cover_image_url: t.cover_image_url, image_url: t.image_url,
      booked: perTrip.get(t.id) || { pax: 0, collected: 0, pending: 0 },
    }))
    .sort((a: any, b: any) => {
      if (a.is_recurring && !b.is_recurring) return 1;
      if (!a.is_recurring && b.is_recurring) return -1;
      return new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime();
    })
    .slice(0, 8);

  // ── movement / today / attention ──
  const sumTxns = (since: string) => active.reduce((s: number, b: any) =>
    s + (b.payment_transactions || []).filter((t: any) => t.payment_status === 'verified' && t.created_at && t.created_at >= since).reduce((x: number, t: any) => x + parseFloat(String(t.amount || 0)), 0), 0);
  const collectedToday = sumTxns(todayIso);
  const collectedThisWeek = sumTxns(weekAgoIso);
  const newBookingsToday = active.filter((b: any) => b.created_at && b.created_at >= todayIso).length;
  const pendingApproval = active.filter((b: any) => (b.payment_transactions || []).some((t: any) => t.payment_status === 'pending')).length;
  const seatLockWithBalance = active.filter((b: any) => b.booking_status === 'seat_locked' && (fullOf(b) - paidOf(b)) > 1).length;

  // Nearest non-recurring departure for the "starts in" hint.
  const nextDated = upcomingTrips.find((t: any) => !t.is_recurring && t.start_date && new Date(t.start_date) >= today);
  const nextTripDays = nextDated ? Math.round((new Date(nextDated.start_date).setHours(0, 0, 0, 0) - today.getTime()) / 86400000) : null;

  // ── Period-scoped "activity" (controlled by the date-range selector) ──
  const periodCollected = active.reduce((s: number, b: any) =>
    s + (b.payment_transactions || []).filter((t: any) => t.payment_status === 'verified' && inRange(t.created_at)).reduce((x: number, t: any) => x + parseFloat(String(t.amount || 0)), 0), 0);
  const periodBookingsArr = active.filter((b: any) => inRange(b.created_at));
  const periodTravellers = periodBookingsArr
    .filter((b: any) => ['confirmed', 'seat_locked'].includes(b.booking_status))
    .reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0);
  const period = {
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
    collected: periodCollected,
    bookings: periodBookingsArr.length,
    confirmed: periodBookingsArr.filter((b: any) => b.booking_status === 'confirmed').length,
    seatLocked: periodBookingsArr.filter((b: any) => b.booking_status === 'seat_locked').length,
    pending: periodBookingsArr.filter((b: any) => b.booking_status === 'pending').length,
    travellers: periodTravellers,
    newUsers: usersRangeRes.count || 0,
  };

  return NextResponse.json({
    period,
    adminName: adminProfileRes.data?.first_name || null,
    totalUsers: usersCountRes.count || 0,
    verifiedUsers: verifiedCountRes.count || 0,
    newUsersToday: usersTodayRes.count || 0,
    activeBookings: active.length,
    confirmed, seatLocked, pending,
    travellers, collected, outstanding,
    activeTrips: tripsData.filter((t: any) => t.is_active !== false && t.status !== 'cancelled').length,
    collectedToday, collectedThisWeek, newBookingsToday,
    pendingApproval, seatLockWithBalance, nextTripDays,
    upcoming: upcomingTrips,
  });
}
