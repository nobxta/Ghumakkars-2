import type { SupabaseClient } from '@supabase/supabase-js';
import { derivePaymentStatus, owedOf } from '@/lib/booking-money';
import { revalidateTripById } from '@/lib/revalidate-trips';

/**
 * Server-only helpers shared by the admin booking/payment routes so they all
 * agree on (a) which bookings occupy a seat and (b) how the denormalized
 * payment mirrors on `bookings` are recomputed from the ledger.
 */

// Booking statuses that occupy a seat on the trip.
export const SEAT_STATUSES = ['confirmed', 'seat_locked', 'on_trip', 'completed', 'referred'];

export const occupiesSeat = (status?: string | null) => SEAT_STATUSES.includes(String(status || ''));

/** Add (or remove, with a negative delta) seats on a trip's current_participants. */
export async function adjustTripSeats(admin: SupabaseClient, tripId: string | null | undefined, delta: number) {
  if (!tripId || !delta) return;
  const { data: trip } = await admin.from('trips').select('current_participants').eq('id', tripId).single();
  if (!trip) return;
  const next = Math.max(0, (Number(trip.current_participants) || 0) + delta);
  await admin.from('trips').update({ current_participants: next, updated_at: new Date().toISOString() }).eq('id', tripId);
  await revalidateTripById(tripId);
}

/** Seat delta for a booking moving from one status to another. */
export function seatDelta(fromStatus: string | null | undefined, toStatus: string | null | undefined, pax: number) {
  const was = occupiesSeat(fromStatus);
  const will = occupiesSeat(toStatus);
  if (will && !was) return pax;
  if (was && !will) return -pax;
  return 0;
}

/**
 * Recompute bookings.amount_paid + payment_status from the full ledger (the
 * ledger is authoritative). Returns the money picture.
 */
export async function syncBookingPaymentMirrors(admin: SupabaseClient, bookingId: string) {
  const { data: b } = await admin
    .from('bookings')
    .select('id, user_id, is_offline_booking, amount_paid, payment_method, booking_status, number_of_participants, total_price, final_amount, coupon_discount, wallet_amount_used, waived_amount, addons_total, trips(discounted_price)')
    .eq('id', bookingId)
    .single();
  if (!b) return null;

  const { data: txns } = await admin
    .from('payment_transactions')
    .select('amount, payment_status, amount_refunded')
    .eq('booking_id', bookingId);
  const ledger = txns || [];

  const paidGross = ledger
    .filter((t: any) => ['verified', 'partially_refunded', 'refunded'].includes(String(t.payment_status)))
    .reduce((s: number, t: any) => s + (parseFloat(String(t.amount || 0)) || 0), 0);
  const refunded = ledger.reduce((s: number, t: any) => s + (parseFloat(String(t.amount_refunded || 0)) || 0), 0);
  const net = Math.max(0, paidGross - refunded);
  // Legacy offline rows with no ledger track money on amount_paid.
  const paid = ledger.length === 0 && ((b as any).is_offline_booking || !(b as any).user_id)
    ? parseFloat(String((b as any).amount_paid || 0)) || 0
    : net;

  const trip = Array.isArray((b as any).trips) ? (b as any).trips[0] : (b as any).trips;
  const owed = owedOf(b as any, trip);
  const status = derivePaymentStatus(paid, owed, refunded > 0);
  await admin.from('bookings').update({ payment_status: status, amount_paid: paid }).eq('id', bookingId);
  return { paid, owed, remaining: Math.max(0, owed - paid), refunded, status };
}

/**
 * Recompute a Razorpay payment's refund totals from payment_refunds.
 * amount_refunded = processed refunds only (money actually returned);
 * payment_status also counts in-flight (pending) refunds so the same money
 * can't be refunded twice while Razorpay is processing.
 */
export async function syncRazorpayRefundTotals(admin: SupabaseClient, paymentId: string) {
  const { data: pt } = await admin
    .from('payment_transactions')
    .select('id, booking_id, amount')
    .eq('id', paymentId)
    .single();
  if (!pt) return null;

  const { data: refunds } = await admin
    .from('payment_refunds')
    .select('amount, status')
    .eq('payment_id', paymentId);
  const rows = refunds || [];
  const processed = rows.filter((r: any) => r.status === 'processed').reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const inFlight = rows.filter((r: any) => r.status !== 'processed' && r.status !== 'failed').reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const locked = processed + inFlight;
  const paid = Number(pt.amount || 0);
  const status = locked <= 0.001 ? 'verified' : locked >= paid - 0.001 ? 'refunded' : 'partially_refunded';

  await admin.from('payment_transactions').update({ amount_refunded: processed, payment_status: status }).eq('id', paymentId);
  if (pt.booking_id) await syncBookingPaymentMirrors(admin, pt.booking_id);
  return { processed, inFlight, locked, remaining: Math.max(0, paid - locked) };
}
