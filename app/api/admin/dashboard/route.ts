import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

// Discount-aware money (same rules as every other screen).
function paidOf(b: any): number {
  if (b.is_offline_booking || !b.user_id) return parseFloat(String(b.amount_paid || 0));
  return (b.payment_transactions || [])
    .filter((t: any) => t.payment_status === 'verified')
    .reduce((s: number, t: any) => s + parseFloat(String(t.amount || 0)), 0);
}
function fullOf(b: any): number {
  const pax = Number(b.number_of_participants) || 1;
  const coupon = parseFloat(String(b.coupon_discount || 0)) || 0;
  const wallet = parseFloat(String(b.wallet_amount_used || 0)) || 0;
  const tripsRel = Array.isArray(b.trips) ? b.trips[0] : b.trips;
  const disc = Number(tripsRel?.discounted_price) || 0;
  if (b.payment_method === 'seat_lock' || b.booking_status === 'seat_locked' || b.booking_status === 'remaining_submitted') {
    return Math.max(0, disc * pax - coupon - wallet);
  }
  const fa = parseFloat(String(b.final_amount || 0));
  if (fa > 0) return fa;
  return Math.max(0, (parseFloat(String(b.total_price || 0)) || disc * pax) - coupon - wallet);
}
const isActive = (b: any) => !['cancelled', 'rejected'].includes(b.booking_status);

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [usersCountRes, verifiedCountRes, tripsRes, bookingsRes] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('email_verified', true),
    admin.from('trips')
      .select('id, title, destination, discounted_price, max_participants, start_date, end_date, is_recurring, recurrence_day, duration_days, is_active, status, cover_image_url, image_url')
      .order('start_date', { ascending: true }),
    admin.from('bookings')
      .select('id, trip_id, booking_status, number_of_participants, departure_date, payment_method, total_price, final_amount, coupon_discount, wallet_amount_used, amount_paid, is_offline_booking, user_id, trips(discounted_price), payment_transactions(amount, payment_status)')
      .limit(10000),
  ]);

  const tripsData = tripsRes.data || [];
  const bookings = bookingsRes.data || [];
  const active = bookings.filter(isActive);

  const collected = active.reduce((s, b) => s + paidOf(b), 0);
  const outstanding = active.reduce((s, b) => s + Math.max(0, fullOf(b) - paidOf(b)), 0);
  const confirmed = bookings.filter((b: any) => b.booking_status === 'confirmed').length;
  const seatLocked = bookings.filter((b: any) => b.booking_status === 'seat_locked').length;
  const pending = bookings.filter((b: any) => b.booking_status === 'pending').length;
  const travellers = active
    .filter((b: any) => ['confirmed', 'seat_locked'].includes(b.booking_status))
    .reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0);

  const perTrip = new Map<string, { pax: number; collected: number }>();
  active.forEach((b: any) => {
    if (!b.trip_id) return;
    const g = perTrip.get(b.trip_id) || { pax: 0, collected: 0 };
    if (['confirmed', 'seat_locked'].includes(b.booking_status)) g.pax += Number(b.number_of_participants) || 1;
    g.collected += paidOf(b);
    perTrip.set(b.trip_id, g);
  });

  const upcoming = tripsData
    .filter((t: any) => t.is_active !== false && t.status !== 'cancelled' && t.status !== 'completed')
    .filter((t: any) => t.is_recurring || !t.end_date || new Date(t.end_date) >= today)
    .map((t: any) => ({
      id: t.id, title: t.title, destination: t.destination, max_participants: t.max_participants,
      start_date: t.start_date, is_recurring: t.is_recurring, recurrence_day: t.recurrence_day,
      cover_image_url: t.cover_image_url, image_url: t.image_url,
      booked: perTrip.get(t.id) || { pax: 0, collected: 0 },
    }))
    .sort((a: any, b: any) => {
      if (a.is_recurring && !b.is_recurring) return 1;
      if (!a.is_recurring && b.is_recurring) return -1;
      return new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime();
    })
    .slice(0, 8);

  return NextResponse.json({
    totalUsers: usersCountRes.count || 0,
    verifiedUsers: verifiedCountRes.count || 0,
    activeBookings: active.length,
    confirmed, seatLocked, pending,
    travellers, collected, outstanding,
    activeTrips: tripsData.filter((t: any) => t.is_active !== false && t.status !== 'cancelled').length,
    upcoming,
  });
}
