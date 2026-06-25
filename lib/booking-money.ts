/**
 * Single source of truth for booking money math.
 *
 * Booking Status (operational) and Payment Status (money) are independent. This
 * module only computes MONEY — never status. The payment ledger
 * (`payment_transactions`) is authoritative; `bookings.amount_paid` /
 * `bookings.payment_status` are denormalized mirrors kept in sync on every change.
 */

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';

interface TripLike {
  discounted_price?: number | string | null;
}

interface BookingLike {
  number_of_participants?: number | null;
  coupon_discount?: number | string | null;
  wallet_amount_used?: number | string | null;
  total_price?: number | string | null;
  final_amount?: number | string | null;
  payment_method?: string | null;
  booking_status?: string | null;
  amount_paid?: number | string | null;
  is_offline_booking?: boolean | null;
  user_id?: string | null;
  // Either an embedded relation or a separately-passed trip.
  trips?: TripLike | TripLike[] | null;
  payment_transactions?: Array<{ amount?: number | string | null; payment_status?: string | null; amount_refunded?: number | string | null }> | null;
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const tripOf = (b: BookingLike, trip?: TripLike | null): TripLike | undefined => {
  if (trip) return trip;
  if (Array.isArray(b.trips)) return b.trips[0];
  return b.trips || undefined;
};

/**
 * The full amount the customer owes, after their coupon + wallet discounts.
 * Seat-lock bookings store only the deposit in total_price/final_amount, so the
 * real cost comes from list price × travellers.
 */
export function fullOwed(b: BookingLike, trip?: TripLike | null): number {
  const pax = Number(b.number_of_participants) || 1;
  const coupon = num(b.coupon_discount);
  const wallet = num(b.wallet_amount_used);
  const disc = num(tripOf(b, trip)?.discounted_price);
  const isSeatLock =
    b.payment_method === 'seat_lock' ||
    b.booking_status === 'seat_locked' ||
    b.booking_status === 'remaining_submitted';

  if (isSeatLock) return Math.max(0, disc * pax - coupon - wallet);

  const fa = num(b.final_amount);
  if (fa > 0) return fa;
  return Math.max(0, (num(b.total_price) || disc * pax) - coupon - wallet);
}

/** Total money actually refunded across the booking's ledger. */
export function refundedOf(b: BookingLike): number {
  const txns = Array.isArray(b.payment_transactions) ? b.payment_transactions : [];
  return txns.reduce((s, t) => s + num(t.amount_refunded), 0);
}

/**
 * Money received and kept. Verified ledger entries minus refunds. Legacy offline
 * bookings (no user / no ledger rows) fall back to `amount_paid`.
 */
export function paidOf(b: BookingLike): number {
  const txns = Array.isArray(b.payment_transactions) ? b.payment_transactions : [];
  if (txns.length === 0 && (b.is_offline_booking || !b.user_id)) {
    return num(b.amount_paid);
  }
  const verified = txns
    .filter((t) => ['verified', 'partially_refunded', 'refunded'].includes(String(t.payment_status)))
    .reduce((s, t) => s + num(t.amount), 0);
  return Math.max(0, verified - refundedOf(b));
}

/** Remaining balance (e.g. to be collected offline on the bus). Never forced to 0. */
export function remainingOf(b: BookingLike, trip?: TripLike | null): number {
  return Math.max(0, fullOwed(b, trip) - paidOf(b));
}

/**
 * Payment Status derived purely from money — completely independent of booking
 * status. A confirmed booking with a balance is correctly "partial".
 */
export function derivePaymentStatus(paid: number, owed: number, hasRefund: boolean): PaymentStatus {
  if (paid <= 0.5) return hasRefund ? 'refunded' : 'pending';
  if (hasRefund && paid <= 0.5) return 'refunded';
  if (paid >= owed - 1) return 'paid';
  return 'partial';
}

/** Convenience: compute the full money picture for a booking in one call. */
export function moneyOf(b: BookingLike, trip?: TripLike | null) {
  const owed = fullOwed(b, trip);
  const paid = paidOf(b);
  const refunded = refundedOf(b);
  const remaining = Math.max(0, owed - paid);
  const status = derivePaymentStatus(paid, owed, refunded > 0);
  return { owed, paid, refunded, remaining, status };
}
