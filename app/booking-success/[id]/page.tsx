'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { resolveDueDate } from '@/lib/payment-due';
import { customerBookingStatus } from '@/lib/booking-status-labels';
import { isPendingCashBooking, moneyOf, pendingCashOf } from '@/lib/booking-money';
import BookingStatusView from '@/components/booking-status/BookingStatusView';
import type { PaymentData } from '@/components/booking-status/BookingSummaryCard';

interface Booking {
  id: string;
  booking_status: string;
  payment_status?: string;
  payment_method?: string;
  payment_mode?: string;
  number_of_participants?: number;
  total_price?: number;
  final_amount?: number;
  payment_amount?: number;
  amount_paid?: number;
  addons_total?: number | string | null;
  coupon_code?: string | null;
  coupon_discount?: number | string | null;
  wallet_amount_used?: number | string | null;
  waived_amount?: number | string | null;
  departure_date?: string | null;
  trips?: {
    title?: string;
    destination?: string;
    start_date?: string;
    end_date?: string;
    is_recurring?: boolean;
    duration_days?: number;
    discounted_price?: number;
    payment_due_days_before?: number | null;
  };
  payment_transactions?: Array<{ amount?: number | string | null; payment_status?: string | null; amount_refunded?: number | string | null }>;
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
          .select(`id, booking_status, payment_status, payment_mode, number_of_participants, total_price, amount_paid, final_amount, payment_amount, payment_method, coupon_code, coupon_discount, wallet_amount_used, waived_amount, addons_total, departure_date,
                   trips:trip_id (title, destination, start_date, end_date, is_recurring, duration_days, discounted_price, payment_due_days_before),
                   payment_transactions ( amount, payment_status, amount_refunded )`)
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
          <p className="font-medium text-blue-600">Loading your booking...</p>
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

  const status = customerBookingStatus(booking.booking_status || 'pending');
  const trip = booking.trips;
  const shortId = booking.id.slice(0, 8).toUpperCase();
  const pax = Number(booking.number_of_participants) || 1;
  const couponDiscount = parseFloat(String(booking.coupon_discount || 0)) || 0;
  const txns = Array.isArray(booking.payment_transactions) ? booking.payment_transactions : [];
  const submittedPending = txns
    .filter((t) => t.payment_status === 'pending')
    .reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);
  const hasSubmitted = submittedPending > 0;

  const money = moneyOf(booking as any, trip as any);
  const pendingCash = pendingCashOf(booking as any, trip as any);
  const isPendingCash = isPendingCashBooking(booking as any);

  const dateRange = buildDateRange(booking, trip);

  let paymentDueBy: string | null = null;
  if (status === 'seat_locked') {
    const effectiveStart = trip?.is_recurring && booking.departure_date ? booking.departure_date : trip?.start_date;
    const due = resolveDueDate(effectiveStart, trip?.payment_due_days_before, null);
    if (due) paymentDueBy = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const payment: PaymentData = {
    paidAmount: money.paid,
    remainingAmount: money.remaining,
    fullCost: money.owed,
    submittedPending,
    dueNow: isPendingCash ? pendingCash.dueNow : undefined,
    remainingAfterDueNow: isPendingCash ? pendingCash.remainingAfterDueNow : undefined,
    pendingCash: isPendingCash,
    couponCode: booking.coupon_code,
    couponDiscount,
    paymentDueBy,
    refundedAmount: money.refunded,
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

function buildDateRange(booking: Booking, trip?: Booking['trips']): string | null {
  if (!trip) return null;
  const dep = booking.departure_date;
  const start = trip.is_recurring && dep ? dep : trip.start_date;
  if (!start) return null;
  let end = trip.end_date;
  if (trip.is_recurring && dep) {
    const [y, m, d] = dep.split('-').map(Number);
    const e = new Date(y, m - 1, d);
    e.setDate(e.getDate() + Math.max(0, (trip.duration_days || 1) - 1));
    end = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
  }
  const startStr = new Date(start + (start.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const endStr = end
    ? new Date(end + (end.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;
  return endStr ? `${startStr} - ${endStr}` : startStr;
}
