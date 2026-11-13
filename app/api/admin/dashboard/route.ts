import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { paidOf, owedOf as fullOf } from '@/lib/booking-money';
import { countOpenProblems } from '@/lib/log-explain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isActive = (b: any) => !['cancelled', 'rejected'].includes(b.booking_status);
// Same rule as the Bookings page: "Collected" is customer money on our own
// (non-partner) bookings. Referred bookings are settled with the partner; what we
// earn on them is the commission, reported separately (partnerCommission).
const isPartner = (b: any) => b.booking_status === 'referred';
const revenueOf = (b: any): number => (isPartner(b) ? 0 : paidOf(b));
const commissionOf = (b: any): number => (isPartner(b) ? parseFloat(String(b.referral_commission || 0)) || 0 : 0);
const dueOf = (b: any): number => (isPartner(b) ? 0 : Math.max(0, fullOf(b) - paidOf(b)));
const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
const tripOf = (b: any) => (Array.isArray(b.trips) ? b.trips[0] : b.trips) || null;

const SEATED = ['confirmed', 'seat_locked', 'remaining_submitted', 'on_trip', 'completed', 'referred'];
const DEPARTURE_WINDOW_DAYS = 14;

// The business runs on India time, but the server runs in UTC. "Today" must start
// at midnight IST, not 05:30 IST.
const IST_OFFSET_MS = 330 * 60000;
const DAY = 86400000;
const startOfTodayIST = () => {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
};
/** IST calendar day ("YYYY-MM-DD") of an instant. */
const istDay = (iso: string | number | Date) => new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
/** Start-of-day (IST) instant for a date-ish value — departure dates are calendar days. */
const dayStart = (d: string) => new Date(`${String(d).slice(0, 10)}T00:00:00+05:30`).getTime();
/** Calendar day of a departure: plain dates stay as-is, timestamps are read in IST. */
const depDay = (v: unknown): string => {
  const s = String(v || '');
  return !s ? '' : s.length <= 10 ? s : istDay(s);
};

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const today = startOfTodayIST();
  const todayIso = today.toISOString();
  const weekAgoIso = new Date(today.getTime() - 7 * DAY).toISOString();

  // Selected period (defaults to last 30 days). Scopes "activity" metrics.
  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const rangeStart = fromParam ? new Date(fromParam) : new Date(today.getTime() - 30 * DAY);
  if (Number.isNaN(rangeStart.getTime())) rangeStart.setTime(today.getTime() - 30 * DAY);
  // The client sends exact instants (start of its first day, end of its last day).
  const rangeEnd = toParam ? new Date(toParam) : new Date();
  if (Number.isNaN(rangeEnd.getTime())) rangeEnd.setTime(Date.now());
  // The equally long window right before it, for "▲ 12% vs previous" deltas.
  const span = Math.max(DAY / 24, rangeEnd.getTime() - rangeStart.getTime());
  const prevStart = new Date(rangeStart.getTime() - span);
  const prevEnd = new Date(rangeStart.getTime() - 1);
  const within = (iso: string | undefined | null, a: Date, b: Date) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= a.getTime() && t <= b.getTime();
  };
  const inRange = (iso?: string | null) => within(iso, rangeStart, rangeEnd);
  const inPrev = (iso?: string | null) => within(iso, prevStart, prevEnd);

  const [
    usersCountRes, verifiedCountRes, usersTodayRes, usersRangeRes, usersPrevRes,
    adminProfileRes, tripsRes, bookingsRes, errorsRes, usersSeriesRes,
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('email_verified', true),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayIso),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', rangeStart.toISOString()).lte('created_at', rangeEnd.toISOString()),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', prevStart.toISOString()).lte('created_at', prevEnd.toISOString()),
    admin.from('profiles').select('first_name').eq('id', auth.user.id).single(),
    admin.from('trips')
      .select('id, title, destination, discounted_price, max_participants, start_date, end_date, is_recurring, recurrence_day, recurrence_weeks_ahead, custom_dates, duration_days, is_active, status, cover_image_url, image_url')
      .order('start_date', { ascending: true }),
    admin.from('bookings')
      .select('id, trip_id, booking_status, number_of_participants, departure_date, payment_method, payment_mode, payment_status, total_price, final_amount, coupon_discount, wallet_amount_used, waived_amount, addons_total, amount_paid, referral_commission, is_offline_booking, user_id, created_at, primary_passenger_name, primary_passenger_phone, primary_passenger_email, trips(title, discounted_price, start_date), payment_transactions(id, amount, payment_status, amount_refunded, created_at, transaction_id, payment_mode, payment_method, payment_type)')
      .order('created_at', { ascending: false })
      .limit(10000),
    admin.from('error_logs').select('level, category, process, message, code, status, resolved').eq('resolved', false).limit(2000),
    admin.from('profiles').select('created_at').gte('created_at', rangeStart.toISOString()).lte('created_at', rangeEnd.toISOString()).limit(20000),
  ]);

  const tripsData = tripsRes.data || [];
  const tripById = new Map<string, any>(tripsData.map((t: any) => [t.id, t]));
  const bookings = bookingsRes.data || [];
  const active = bookings.filter(isActive);
  const own = active.filter((b: any) => !isPartner(b));

  const collected = active.reduce((s, b) => s + revenueOf(b), 0);
  const partnerCommission = active.reduce((s, b) => s + commissionOf(b), 0);
  const outstanding = active.reduce((s, b) => s + dueOf(b), 0);
  const outstandingBookings = active.filter((b) => dueOf(b) > 1).length;

  // ── Verified money, bucketed ──
  const verifiedTxns = own.flatMap((b: any) =>
    (b.payment_transactions || []).filter((t: any) => t.payment_status === 'verified' && t.created_at),
  );
  const sumTxns = (pred: (iso: string) => boolean) => verifiedTxns.filter((t: any) => pred(t.created_at)).reduce((x: number, t: any) => x + num(t.amount), 0);
  const collectedToday = sumTxns((iso) => iso >= todayIso);
  const collectedThisWeek = sumTxns((iso) => iso >= weekAgoIso);

  const newBookingsToday = active.filter((b: any) => b.created_at && b.created_at >= todayIso).length;
  const seatLockWithBalance = active.filter((b: any) => b.booking_status === 'seat_locked' && dueOf(b) > 1).length;

  // ── Period vs previous period ──
  const periodOf = (pred: (iso?: string | null) => boolean, newUsers: number) => {
    const arr = active.filter((b: any) => pred(b.created_at));
    return {
      collected: sumTxns((iso) => pred(iso)),
      bookings: arr.length,
      confirmed: arr.filter((b: any) => b.booking_status === 'confirmed').length,
      seatLocked: arr.filter((b: any) => b.booking_status === 'seat_locked').length,
      pending: arr.filter((b: any) => b.booking_status === 'pending').length,
      travellers: arr.filter((b: any) => SEATED.includes(b.booking_status)).reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0),
      newUsers,
    };
  };
  const period = { from: rangeStart.toISOString(), to: rangeEnd.toISOString(), ...periodOf(inRange, usersRangeRes.count || 0) };
  const prev = { from: prevStart.toISOString(), to: prevEnd.toISOString(), ...periodOf(inPrev, usersPrevRes.count || 0) };

  // ── Daily series for sparklines (IST days, capped at 120 points) ──
  const series: { day: string; collected: number; bookings: number; users: number }[] = [];
  {
    const firstDay = istDay(rangeStart);
    const lastDay = istDay(rangeEnd);
    const idx = new Map<string, number>();
    for (let t = dayStart(firstDay); istDay(t) <= lastDay && series.length < 120; t += DAY) {
      const day = istDay(t);
      idx.set(day, series.length);
      series.push({ day, collected: 0, bookings: 0, users: 0 });
    }
    verifiedTxns.forEach((t: any) => { if (inRange(t.created_at)) { const i = idx.get(istDay(t.created_at)); if (i != null) series[i].collected += num(t.amount); } });
    active.forEach((b: any) => { if (inRange(b.created_at)) { const i = idx.get(istDay(b.created_at)); if (i != null) series[i].bookings += 1; } });
    (usersSeriesRes.data || []).forEach((u: any) => { const i = idx.get(istDay(u.created_at)); if (i != null) series[i].users += 1; });
  }

  // ── Departures board: seated bookings grouped by (trip, departure day) ──
  const nowDay = istDay(today);
  const horizon = istDay(today.getTime() + DEPARTURE_WINDOW_DAYS * DAY);
  const depMap = new Map<string, any>();
  active.forEach((b: any) => {
    if (!b.trip_id) return;
    const trip = tripById.get(b.trip_id);
    const dep = depDay(b.departure_date || trip?.start_date);
    if (!dep || dep < nowDay || dep > horizon) return;
    const key = `${b.trip_id}|${dep}`;
    const g = depMap.get(key) || {
      key, tripId: b.trip_id, date: dep, title: trip?.title || tripOf(b)?.title || 'Trip', destination: trip?.destination || '',
      cover: trip?.cover_image_url || trip?.image_url || null, capacity: Number(trip?.max_participants) || 0,
      pax: 0, bookings: 0, collected: 0, due: 0, dueBookingIds: [] as string[], pendingReview: 0,
    };
    if (SEATED.includes(b.booking_status)) g.pax += Number(b.number_of_participants) || 1;
    g.bookings += 1;
    g.collected += revenueOf(b);
    const d = dueOf(b);
    g.due += d;
    if (d > 1 && b.booking_status !== 'pending') g.dueBookingIds.push(b.id);
    if ((b.payment_transactions || []).some((t: any) => t.payment_status === 'pending')) g.pendingReview += 1;
    depMap.set(key, g);
  });
  // Dated (non-recurring) trips in the window with no bookings yet still belong on the board.
  tripsData.forEach((t: any) => {
    if (t.is_recurring || t.is_active === false || t.status === 'cancelled' || t.status === 'completed') return;
    const dep = depDay(t.start_date);
    if (!dep || dep < nowDay || dep > horizon || depMap.has(`${t.id}|${dep}`)) return;
    depMap.set(`${t.id}|${dep}`, {
      key: `${t.id}|${dep}`, tripId: t.id, date: dep, title: t.title, destination: t.destination || '',
      cover: t.cover_image_url || t.image_url || null, capacity: Number(t.max_participants) || 0,
      pax: 0, bookings: 0, collected: 0, due: 0, dueBookingIds: [], pendingReview: 0,
    });
  });
  const departures = Array.from(depMap.values())
    .map((g) => ({ ...g, daysAway: Math.round((dayStart(g.date) - dayStart(nowDay)) / DAY) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  // ── Action inbox ──
  const personOf = (b: any) => ({
    name: b.primary_passenger_name || 'Customer',
    phone: b.primary_passenger_phone || null,
    email: b.primary_passenger_email || null,
  });
  const departureOf = (b: any) => depDay(b.departure_date || tripById.get(b.trip_id)?.start_date) || null;

  const approvals = active.flatMap((b: any) =>
    (b.payment_transactions || [])
      .filter((t: any) => t.payment_status === 'pending')
      .map((t: any) => ({
        kind: 'approval' as const,
        txnId: t.id,
        bookingId: b.id,
        amount: num(t.amount),
        reference: t.transaction_id || null,
        method: t.payment_method || t.payment_mode || null,
        paymentType: t.payment_type || null,
        createdAt: t.created_at,
        ...personOf(b),
        trip: tripById.get(b.trip_id)?.title || tripOf(b)?.title || 'Trip',
        departure: departureOf(b),
        pax: Number(b.number_of_participants) || 1,
        bookingStatus: b.booking_status,
        owed: fullOf(b),
        paid: paidOf(b),
      })),
  ).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  const cashPending = active
    .filter((b: any) => b.payment_mode === 'cash' && ['cash_pending', 'pending_cash'].includes(String(b.payment_status)))
    .map((b: any) => ({
      kind: 'cash' as const, bookingId: b.id, createdAt: b.created_at, ...personOf(b),
      trip: tripById.get(b.trip_id)?.title || tripOf(b)?.title || 'Trip', departure: departureOf(b), amount: dueOf(b),
    }));

  // Balances due on departures within the window — the ones worth chasing now.
  const dueSoon = active
    .filter((b: any) => b.booking_status !== 'pending' && dueOf(b) > 1)
    .map((b: any) => ({ b, dep: departureOf(b) }))
    .filter(({ dep }) => dep && dep >= nowDay && dep <= istDay(today.getTime() + 7 * DAY))
    .map(({ b, dep }) => ({
      kind: 'due' as const, bookingId: b.id, ...personOf(b), trip: tripById.get(b.trip_id)?.title || tripOf(b)?.title || 'Trip',
      departure: dep, daysAway: Math.round((dayStart(dep!) - dayStart(nowDay)) / DAY), amount: dueOf(b),
    }))
    .sort((a, b) => a.daysAway - b.daysAway || b.amount - a.amount);

  // Departures within a week that are less than 40% full.
  const lowFill = departures
    .filter((d) => d.daysAway <= 7 && d.capacity > 0 && d.pax / d.capacity < 0.4)
    .map((d) => ({ kind: 'lowfill' as const, tripId: d.tripId, trip: d.title, departure: d.date, daysAway: d.daysAway, pax: d.pax, capacity: d.capacity }));

  // ── Top trips in the period (by money collected in it) ──
  const tripAgg = new Map<string, { tripId: string; title: string; cover: string | null; bookings: number; travellers: number; collected: number; due: number }>();
  const tripRow = (id: string, b?: any) => {
    let g = tripAgg.get(id);
    if (!g) {
      const t = tripById.get(id);
      g = { tripId: id, title: t?.title || (b && tripOf(b)?.title) || 'Trip', cover: t?.cover_image_url || t?.image_url || null, bookings: 0, travellers: 0, collected: 0, due: 0 };
      tripAgg.set(id, g);
    }
    return g;
  };
  own.forEach((b: any) => {
    if (!b.trip_id) return;
    (b.payment_transactions || []).forEach((t: any) => {
      if (t.payment_status === 'verified' && inRange(t.created_at)) tripRow(b.trip_id, b).collected += num(t.amount);
    });
  });
  active.forEach((b: any) => {
    if (!b.trip_id || !inRange(b.created_at)) return;
    const g = tripRow(b.trip_id, b);
    g.bookings += 1;
    if (SEATED.includes(b.booking_status)) g.travellers += Number(b.number_of_participants) || 1;
    g.due += dueOf(b);
  });
  const topTrips = Array.from(tripAgg.values())
    .filter((g) => g.collected > 0 || g.bookings > 0)
    .sort((a, b) => b.collected - a.collected || b.bookings - a.bookings)
    .slice(0, 5);

  // ── Booking pipeline for the period (every booking made in it, cancelled too) ──
  const madeInRange = bookings.filter((b: any) => inRange(b.created_at));
  const countStatus = (...s: string[]) => madeInRange.filter((b: any) => s.includes(b.booking_status)).length;
  const pipeline = {
    pending: countStatus('pending'),
    seatLocked: countStatus('seat_locked', 'remaining_submitted'),
    confirmed: countStatus('confirmed', 'on_trip'),
    completed: countStatus('completed'),
    referred: countStatus('referred'),
    cancelled: countStatus('cancelled', 'rejected'),
    total: madeInRange.length,
  };

  // ── How money came in during the period ──
  const methodLabel = (t: any) => {
    const m = String(t.payment_method || t.payment_mode || 'other').toLowerCase();
    if (m.includes('razorpay') || m.includes('online') || m.includes('card')) return 'Online';
    if (m.includes('upi') || m.includes('qr')) return 'UPI';
    if (m.includes('cash')) return 'Cash';
    if (m.includes('bank') || m.includes('neft') || m.includes('imps')) return 'Bank';
    if (m.includes('wallet')) return 'Wallet';
    return 'Other';
  };
  const mix = new Map<string, { method: string; amount: number; count: number }>();
  verifiedTxns.forEach((t: any) => {
    if (!inRange(t.created_at)) return;
    const k = methodLabel(t);
    const g = mix.get(k) || { method: k, amount: 0, count: 0 };
    g.amount += num(t.amount);
    g.count += 1;
    mix.set(k, g);
  });
  const paymentMix = Array.from(mix.values()).sort((a, b) => b.amount - a.amount);

  // ── Latest bookings (any status) ──
  const recentBookings = bookings.slice(0, 6).map((b: any) => ({
    id: b.id,
    name: b.primary_passenger_name || 'Customer',
    trip: tripById.get(b.trip_id)?.title || tripOf(b)?.title || 'Trip',
    pax: Number(b.number_of_participants) || 1,
    status: b.booking_status,
    total: isPartner(b) ? 0 : fullOf(b),
    paid: revenueOf(b),
    departure: departureOf(b),
    createdAt: b.created_at,
    offline: !!b.is_offline_booking,
  }));

  // ── Previous period, day-aligned to `series`, for the "vs before" overlay ──
  const prevSeries: number[] = series.map(() => 0);
  {
    const base = dayStart(istDay(prevStart));
    verifiedTxns.forEach((t: any) => {
      if (!inPrev(t.created_at)) return;
      const i = Math.round((dayStart(istDay(t.created_at)) - base) / DAY);
      if (i >= 0 && i < prevSeries.length) prevSeries[i] += num(t.amount);
    });
  }

  // ── When people book: weekday (Mon=0) × 3-hour block, IST ──
  const bookingHeat: number[][] = Array.from({ length: 7 }, () => Array(8).fill(0));
  madeInRange.forEach((b: any) => {
    const ist = new Date(new Date(b.created_at).getTime() + IST_OFFSET_MS);
    bookingHeat[(ist.getUTCDay() + 6) % 7][Math.floor(ist.getUTCHours() / 3)] += 1;
  });

  const periodOwn = own.filter((b: any) => inRange(b.created_at));
  const avgBookingValue = periodOwn.length ? periodOwn.reduce((s: number, b: any) => s + fullOf(b), 0) / periodOwn.length : 0;

  const pendingApproval = new Set(approvals.map((a) => a.bookingId)).size;
  const nextDep = departures.find((d) => d.pax > 0) || departures[0];

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    period, prev, series,
    adminName: adminProfileRes.data?.first_name || null,
    totalUsers: usersCountRes.count || 0,
    verifiedUsers: verifiedCountRes.count || 0,
    newUsersToday: usersTodayRes.count || 0,
    activeBookings: active.length,
    collected, outstanding, outstandingBookings, partnerCommission,
    activeTrips: tripsData.filter((t: any) => t.is_active !== false && t.status !== 'cancelled' && t.status !== 'completed').length,
    collectedToday, collectedThisWeek, newBookingsToday,
    pendingApproval, seatLockWithBalance,
    nextTripDays: nextDep ? nextDep.daysAway : null,
    unresolvedErrors: countOpenProblems((errorsRes.data || []) as any),
    inbox: { approvals, cashPending, dueSoon, lowFill },
    departures,
    topTrips, pipeline, paymentMix, recentBookings, avgBookingValue, prevSeries, bookingHeat,
  });
}
