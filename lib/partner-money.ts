/**
 * Partner (referred) booking money — single source of truth, safe on client and
 * server.
 *
 * When a customer is handed to another operator ("partner"):
 *   customer price  = what the customer owes in total (normal booking money math)
 *   partner price   = what the partner keeps for running the trip
 *   margin          = customer price − partner price (what we earn)
 *   paid to us      = ledger rows with collected_by = 'us' (Razorpay, UPI, cash to us)
 *   paid to partner = ledger rows with collected_by = 'partner' (e.g. cash on the bus)
 *   settlements     = money moved between us and the partner, either direction
 *
 *   partner balance = partner price − paid to partner − (we paid partner) + (partner paid us)
 *     > 0  we owe the partner
 *     < 0  the partner owes us
 *
 * Older referrals saved only a "commission" number. They have no partner price
 * (partner_price NULL): their margin is that commission and settlement is shown as
 * "not tracked" until an admin adds a partner price.
 */
import { owedOf } from '@/lib/booking-money';

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Treat sub-rupee leftovers as zero so "square" reads as square. */
const clean = (n: number) => (Math.abs(n) < 0.5 ? 0 : r2(n));

const PAID_STATES = ['verified', 'partially_refunded', 'refunded'];

export interface LedgerRowLike {
  amount?: number | string | null;
  amount_refunded?: number | string | null;
  payment_status?: string | null;
  collected_by?: string | null;
}

export interface SettlementLike {
  id?: string;
  booking_id?: string | null;
  partner_id?: string | null;
  direction: 'to_partner' | 'from_partner' | string;
  amount: number | string;
}

export interface PartnerBookingLike {
  id?: string;
  partner_id?: string | null;
  partner_price?: number | string | null;
  referral_commission?: number | string | null;
  booking_status?: string | null;
  number_of_participants?: number | null;
  amount_paid?: number | string | null;
  is_offline_booking?: boolean | null;
  user_id?: string | null;
  payment_transactions?: LedgerRowLike[] | null;
  [k: string]: any;
}

export const isPartnerBooking = (b: { partner_id?: string | null; booking_status?: string | null } | null | undefined) =>
  !!b && (!!b.partner_id || b.booking_status === 'referred');

export const isPartnerCollected = (t: LedgerRowLike | null | undefined) => t?.collected_by === 'partner';

/**
 * Split money the customer has paid (net of refunds) by who received it.
 * Mirrors paidOf(): legacy offline bookings with no ledger use amount_paid (ours).
 */
export function paidSplitOf(b: PartnerBookingLike) {
  const txns = Array.isArray(b.payment_transactions) ? b.payment_transactions : [];
  if (txns.length === 0 && (b.is_offline_booking || !b.user_id)) {
    return { toUs: r2(num(b.amount_paid)), toPartner: 0 };
  }
  let toUs = 0;
  let toPartner = 0;
  for (const t of txns) {
    const gross = PAID_STATES.includes(String(t.payment_status)) ? num(t.amount) : 0;
    const net = gross - num(t.amount_refunded);
    if (isPartnerCollected(t)) toPartner += net;
    else toUs += net;
  }
  return { toUs: r2(Math.max(0, toUs)), toPartner: r2(Math.max(0, toPartner)) };
}

/** Money WE actually received for a booking (excludes cash the partner collected). */
export const paidToUsOf = (b: PartnerBookingLike) => paidSplitOf(b).toUs;

export type PartnerState = 'we_owe' | 'they_owe' | 'square' | 'untracked';

export function partnerMoneyOf(
  b: PartnerBookingLike,
  trip?: any,
  settlements: SettlementLike[] = [],
) {
  const isPartner = isPartnerBooking(b);
  const isLegacy = b.partner_price == null || b.partner_price === '';
  const cancelled = ['cancelled', 'rejected'].includes(String(b.booking_status));
  const { toUs, toPartner } = paidSplitOf(b);

  // A cancelled booking's "price" is whatever the customer ended up paying.
  const customerPrice = r2(cancelled ? toUs + toPartner : owedOf(b as any, trip));
  const customerDue = clean(Math.max(0, customerPrice - toUs - toPartner));

  // Only settlements recorded against THIS booking (lump sums live on the account).
  const mine = settlements.filter((s) => !!b.id && s.booking_id === b.id);
  const paidByUsToPartner = r2(mine.filter((s) => s.direction === 'to_partner').reduce((s, x) => s + num(x.amount), 0));
  const paidByPartnerToUs = r2(mine.filter((s) => s.direction === 'from_partner').reduce((s, x) => s + num(x.amount), 0));

  const partnerPrice = isLegacy ? null : r2(num(b.partner_price));
  const margin = r2(isLegacy ? num(b.referral_commission) : customerPrice - (partnerPrice || 0));

  // Right now: > 0 we owe the partner, < 0 the partner owes us.
  const balanceNow = isLegacy ? 0 : clean((partnerPrice || 0) - toPartner - paidByUsToPartner + paidByPartnerToUs);
  // Headline: assumes the partner collects whatever the customer still owes (the
  // usual case: cash at boarding). If we collect it instead, recording that
  // payment as ours moves this number automatically.
  const balance = isLegacy ? 0 : clean(balanceNow - customerDue);

  const state: PartnerState = isLegacy ? 'untracked' : balance > 0 ? 'we_owe' : balance < 0 ? 'they_owe' : 'square';

  return {
    isPartner,
    isLegacy,
    cancelled,
    customerPrice,
    partnerPrice,
    margin,
    paidToUs: toUs,
    paidToPartner: toPartner,
    customerDue,
    paidByUsToPartner,
    paidByPartnerToUs,
    balance,
    balanceNow,
    state,
    /** Money in our hands for this booking after settling up. */
    weKeep: r2(toUs - paidByUsToPartner + paidByPartnerToUs),
  };
}

/** Partner price total from a rate + basis. */
export function partnerPriceFrom(basis: 'per_person' | 'total' | string | null | undefined, rate: number, pax: number) {
  return r2(basis === 'total' ? rate : rate * Math.max(1, pax || 1));
}

/**
 * A partner's whole account across bookings. Settlements linked to a booking are
 * counted on that booking; unlinked (lump-sum) settlements apply to the account.
 */
export function partnerAccountOf(
  bookings: PartnerBookingLike[],
  settlements: SettlementLike[],
  tripOf: (b: PartnerBookingLike) => any = (b) => (Array.isArray(b.trips) ? b.trips[0] : b.trips),
) {
  let margin = 0;
  let bookingBalance = 0;
  let customerDue = 0;
  let pax = 0;
  let untracked = 0;
  let paidToPartner = 0;
  let paidToUs = 0;
  const rows = bookings.map((b) => {
    const linked = settlements.filter((s) => s.booking_id && s.booking_id === b.id);
    const m = partnerMoneyOf(b, tripOf(b), linked);
    margin += m.margin;
    bookingBalance += m.balance;
    // Older referrals aren't settled through the app, so their dues don't count here.
    if (!m.isLegacy) customerDue += m.customerDue;
    paidToPartner += m.paidToPartner;
    paidToUs += m.paidToUs;
    pax += Number(b.number_of_participants) || 1;
    if (m.isLegacy) untracked += 1;
    return { booking: b, money: m };
  });
  const unlinked = settlements.filter((s) => !s.booking_id || !bookings.some((b) => b.id === s.booking_id));
  const unlinkedTo = unlinked.filter((s) => s.direction === 'to_partner').reduce((s, x) => s + num(x.amount), 0);
  const unlinkedFrom = unlinked.filter((s) => s.direction === 'from_partner').reduce((s, x) => s + num(x.amount), 0);
  const balance = clean(bookingBalance - unlinkedTo + unlinkedFrom);
  return {
    rows,
    bookings: bookings.length,
    pax,
    margin: r2(margin),
    customerDue: r2(customerDue),
    paidToPartner: r2(paidToPartner),
    paidToUs: r2(paidToUs),
    untracked,
    balance,
    weOwe: balance > 0 ? balance : 0,
    theyOwe: balance < 0 ? -balance : 0,
  };
}

export const PARTNER_SETTLEMENT_METHODS = ['upi', 'cash', 'bank', 'card', 'other'] as const;
