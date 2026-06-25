'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { resolveDueDate } from '@/lib/payment-due';
import BookingStatusView from '@/components/booking-status/BookingStatusView';
import type { PaymentData } from '@/components/booking-status/BookingSummaryCard';

interface Booking {
  id: string;
  booking_status: string;
  number_of_participants?: number;
  total_price?: number;
  amount_paid?: number;
  final_amount?: number;
  coupon_code?: string | null;
  coupon_discount?: number | string | null;
  departure_date?: string | null;
  trips?: {
    title?: string;
    destination?: string;
    start_date?: string;
    end_date?: string;
    is_recurring?: boolean;
    duration_days?: number;
    payment_due_days_before?: number | null;
  };
}

export default function BookingSuccessPage() {
  const params = useParams();
  const supabase = createClient();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const bookingId = params.id as string;

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`id, booking_status, number_of_participants, total_price, amount_paid, final_amount, payment_amount, payment_method, coupon_code, coupon_discount, wallet_amount_used, departure_date,
                   trips:trip_id (title, destination, start_date, end_date, is_recurring, duration_days, discounted_price, payment_due_days_before),
                   payment_transactions ( amount, payment_status )`)
          .eq('id', bookingId)
          .single();
        if (error) throw error;
        setBooking(data as unknown as Booking);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId, supabase]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f9f9ff]">
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          <p className="font-medium text-blue-600">Loading your booking…</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f9f9ff] px-4 text-center">
        <div>
          <p className="mb-4 text-gray-700">Booking not found.</p>
          <Link href="/trips" className="font-semibold text-blue-700 underline">Browse trips</Link>
        </div>
      </div>
    );
  }

  // ---- Business logic (unchanged from the original confirmation page) ----
  const status = booking.booking_status || 'pending';
  const trip = booking.trips;
  const shortId = booking.id.slice(0, 8).toUpperCase();
  const pax = Number(booking.number_of_participants) || 1;
  const couponDiscount = parseFloat(String(booking.coupon_discount || 0)) || 0;
  const walletUsed = parseFloat(String((booking as any).wallet_amount_used || 0)) || 0;

  // Seat-lock bookings store only the deposit in final_amount/total_price, so the
  // real trip cost comes from list price × travellers.
  const isSeatLockBooking = (booking as any).payment_method === 'seat_lock' || status === 'seat_locked';
  const grossFull = (Number((trip as any)?.discounted_price) || 0) * pax;
  const fullCost = isSeatLockBooking
    ? Math.max(0, grossFull - couponDiscount - walletUsed)
    : parseFloat(String(booking.final_amount || booking.total_price || 0));

  // Money received = verified transactions (the approved deposit), else amount_paid.
  const txns: any[] = Array.isArray((booking as any).payment_transactions) ? (booking as any).payment_transactions : [];
  const verifiedPaid = txns.filter((t) => t.payment_status === 'verified').reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);
  const paidAmount = verifiedPaid || parseFloat(String(booking.amount_paid || (booking as any).payment_amount || 0));
  const remainingAmount = Math.max(0, fullCost - paidAmount);
  // Money submitted but not yet verified — so we never scare the customer with "₹0 paid".
  const submittedPending = txns.filter((t) => t.payment_status === 'pending').reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);
  const hasSubmitted = submittedPending > 0;

  // ---- Derived display values ----
  const dateRange = buildDateRange(booking, trip);

  // Seat-lock balance deadline (same source of truth as booking details / emails).
  let paymentDueBy: string | null = null;
  if (status === 'seat_locked') {
    const effectiveStart = (trip as any)?.is_recurring && booking.departure_date ? booking.departure_date : trip?.start_date;
    const due = resolveDueDate(effectiveStart, trip?.payment_due_days_before, null);
    if (due) paymentDueBy = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const payment: PaymentData = {
    paidAmount,
    remainingAmount,
    fullCost,
    submittedPending,
    couponCode: booking.coupon_code,
    couponDiscount,
    paymentDueBy,
    refundedAmount: 0,
  };

  return (
    <BookingStatusView
      bookingId={booking.id}
      status={status}
      shortId={shortId}
      guests={pax}
      tripTitle={trip?.title}
      destination={trip?.destination}
      dateRange={dateRange}
      hasSubmitted={hasSubmitted}
      payment={payment}
    />
  );
}

/** Formats the trip date range, accounting for recurring departures. */
function buildDateRange(booking: Booking, trip?: Booking['trips']): string | null {
  if (!trip) return null;
  const dep = booking.departure_date;
  const start = (trip as any).is_recurring && dep ? dep : trip.start_date;
  if (!start) return null;
  let end = trip.end_date;
  if ((trip as any).is_recurring && dep) {
    const [y, m, d] = dep.split('-').map(Number);
    const e = new Date(y, m - 1, d);
    e.setDate(e.getDate() + Math.max(0, ((trip as any).duration_days || 1) - 1));
    end = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
  }
  const startStr = new Date(start + (start.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  const endStr = end
    ? new Date(end + (end.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;
  return endStr ? `${startStr} → ${endStr}` : startStr;
}
