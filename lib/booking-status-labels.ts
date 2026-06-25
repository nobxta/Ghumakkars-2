/**
 * Shared labels + customer-facing mapping for booking & payment status.
 * Reused by admin, customer booking page, booking-success and list views so the
 * chips stay consistent everywhere.
 */
import type { PaymentStatus } from './booking-money';

/** The six admin-selectable operational statuses (plus the hidden `pending`). */
export const BOOKING_STATUSES = [
  'seat_locked',
  'confirmed',
  'on_trip',
  'completed',
  'cancelled',
  'referred',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number] | 'pending';

export function bookingStatusLabel(status?: string | null): string {
  switch (status) {
    case 'seat_locked': return 'Seat Locked';
    case 'confirmed': return 'Confirmed';
    case 'on_trip': return 'On Trip';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'referred': return 'Referred';
    case 'remaining_submitted': return 'Seat Locked';
    case 'pending':
    default: return 'Pending';
  }
}

export function paymentStatusLabel(status?: PaymentStatus | string | null): string {
  switch (status) {
    case 'paid': return 'Paid';
    case 'partial': return 'Partial Payment';
    case 'refunded': return 'Refunded';
    case 'partially_refunded': return 'Partially Refunded';
    case 'pending':
    default: return 'Pending';
  }
}

/**
 * What the CUSTOMER sees. A referred booking is operationally confirmed for the
 * traveller — the word "Referred" and all partner/commission data stay admin-only.
 */
export function customerBookingStatus(status?: string | null): string {
  if (status === 'referred') return 'confirmed';
  if (status === 'remaining_submitted') return 'seat_locked';
  return status || 'pending';
}

export function customerBookingStatusLabel(status?: string | null): string {
  return bookingStatusLabel(customerBookingStatus(status));
}

/** Tailwind chip classes for a booking status (admin chips). */
export function bookingStatusChip(status?: string | null): string {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'seat_locked':
    case 'remaining_submitted': return 'bg-amber-100 text-amber-800';
    case 'on_trip': return 'bg-blue-100 text-blue-800';
    case 'completed': return 'bg-purple-100 text-purple-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'referred': return 'bg-indigo-100 text-indigo-800';
    case 'pending':
    default: return 'bg-gray-100 text-gray-700';
  }
}

/** Tailwind chip classes for a payment status. */
export function paymentStatusChip(status?: PaymentStatus | string | null): string {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800';
    case 'partial': return 'bg-orange-100 text-orange-800';
    case 'refunded':
    case 'partially_refunded': return 'bg-rose-100 text-rose-800';
    case 'pending':
    default: return 'bg-gray-100 text-gray-700';
  }
}
