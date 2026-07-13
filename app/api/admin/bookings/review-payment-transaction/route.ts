import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, isInternalRequest, internalFetchHeaders } from '@/lib/auth-helpers';
import { revalidateTripById } from '@/lib/revalidate-trips';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, status, reviewNotes, rejectionReason } = body;

    // Auth: admin session (website) OR an internal server call (Telegram bot).
    let reviewerId: string | null = null;
    if (isInternalRequest(request)) {
      reviewerId = body.reviewedBy || null;
    } else {
      const auth = await requireAdmin();
      if (auth instanceof NextResponse) return auth;
      reviewerId = auth.user.id;
    }

    if (!transactionId || !status) {
      return NextResponse.json(
        { error: 'transactionId and status are required' },
        { status: 400 }
      );
    }

    if (status === 'rejected' && !rejectionReason) {
      return NextResponse.json(
        { error: 'rejectionReason is required when rejecting payment' },
        { status: 400 }
      );
    }

    // Use admin client to update payment transaction (bypasses RLS)
    const adminClient = createAdminClient();

    // Fetch payment transaction
    const { data: paymentTransaction, error: fetchError } = await adminClient
      .from('payment_transactions')
      .select('*, bookings(trip_id, user_id, number_of_participants, payment_method)')
      .eq('id', transactionId)
      .single();

    if (fetchError || !paymentTransaction) {
      return NextResponse.json(
        { error: 'Payment transaction not found' },
        { status: 404 }
      );
    }

    const booking = paymentTransaction.bookings as any;
    const bookingId = paymentTransaction.booking_id;

    // Update payment transaction
    const { error: updateError } = await adminClient
      .from('payment_transactions')
      .update({
        payment_status: status,
        payment_reviewed_at: new Date().toISOString(),
        payment_reviewed_by: reviewerId,
        payment_review_notes: reviewNotes || null,
        rejection_reason: status === 'rejected' ? rejectionReason : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    if (updateError) {
      console.error('Error updating payment transaction:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update payment transaction' },
        { status: 500 }
      );
    }

    // Recompute the booking's DERIVED payment status from the full ledger.
    // Booking Status and Payment Status are independent: verifying a payment updates
    // the money picture and (only for a brand-new booking) activates the seat — it
    // NEVER auto-confirms based on how much was paid.
    const { data: allPayments, error: paymentsError } = await adminClient
      .from('payment_transactions')
      .select('payment_status, payment_type, amount, amount_refunded')
      .eq('booking_id', bookingId);

    let finalBookingStatus = booking?.booking_status || 'pending';
    let statusChanged = false;
    if (!paymentsError && allPayments) {
      const { derivePaymentStatus, fullOwed } = await import('@/lib/booking-money');

      const { data: bookingData } = await adminClient
        .from('bookings')
        .select('booking_status, payment_method, final_amount, total_price, coupon_discount, wallet_amount_used, addons_total, number_of_participants, trips(discounted_price)')
        .eq('id', bookingId)
        .single();

      const currentStatus = (bookingData as any)?.booking_status || 'pending';
      const verifiedPaid = allPayments
        .filter(p => ['verified', 'partially_refunded', 'refunded'].includes(String(p.payment_status)))
        .reduce((sum, p) => sum + parseFloat(String(p.amount || 0)), 0);
      const refunded = allPayments.reduce((s, p) => s + parseFloat(String((p as any).amount_refunded || 0)), 0);
      const netPaid = Math.max(0, verifiedPaid - refunded);
      const owed = fullOwed(bookingData as any, (bookingData as any)?.trips);
      const paymentStatus = derivePaymentStatus(netPaid, owed, refunded > 0);

      const hasRejected = allPayments.some(p => p.payment_status === 'rejected');
      const hasVerified = allPayments.some(p => p.payment_status === 'verified');

      // Decide the operational booking status WITHOUT coupling it to amount paid:
      //  - a rejected-only booking that never had a verified payment → rejected
      //  - a brand-new (pending) booking with its first verified payment → seat_locked
      //  - otherwise leave the admin-controlled status exactly as it is
      let bookingStatus = currentStatus;
      if (hasRejected && !hasVerified) {
        bookingStatus = 'rejected';
      } else if (hasVerified && currentStatus === 'pending') {
        bookingStatus = paymentStatus === 'paid' && (bookingData as any)?.payment_method !== 'seat_lock'
          ? 'confirmed'
          : 'seat_locked';
      }
      finalBookingStatus = bookingStatus;
      statusChanged = bookingStatus !== currentStatus;

      await adminClient
        .from('bookings')
        .update({ booking_status: bookingStatus, payment_status: paymentStatus, amount_paid: netPaid })
        .eq('id', bookingId);

      // Settle add-ons for the status display once the booking is fully paid.
      if (paymentStatus === 'paid' && (bookingData as any)?.payment_method !== 'seat_lock') {
        const { markBookingAddonsPaid } = await import('@/lib/addons-server');
        await markBookingAddonsPaid(adminClient, bookingId).catch(() => {});
      }

      // When the booking first activates (pending → seat_locked), hold the seat.
      const activated = currentStatus === 'pending' && bookingStatus === 'seat_locked';
      if (activated && booking.trip_id) {
        try {
          const { data: trip } = await adminClient
            .from('trips')
            .select('current_participants')
            .eq('id', booking.trip_id)
            .single();

          if (trip) {
            await adminClient
              .from('trips')
              .update({
                current_participants: (trip.current_participants || 0) + (booking.number_of_participants || 1),
                updated_at: new Date().toISOString(),
              })
              .eq('id', booking.trip_id);
          }
          // Seat held on activation — refresh this trip's public pages.
          await revalidateTripById(booking.trip_id);
        } catch (tripError) {
          console.error('Error incrementing trip participants:', tripError);
        }

        // Process referral reward on first confirmed/seat_locked booking
        try {
          const { count: previousBookings } = await adminClient
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', (paymentTransaction as any).bookings?.user_id)
            .in('booking_status', ['confirmed', 'seat_locked'])
            .neq('id', bookingId);

          if (previousBookings === 0) {
            await adminClient.rpc('process_referral_reward', { p_booking_id: bookingId });
          }
        } catch (referralError) {
          console.error('Error processing referral reward:', referralError);
        }
      }
    }

    // Notify the customer (email + WhatsApp) now that the status is decided.
    // This route previously updated the booking silently — that's why seat-lock
    // / confirmed messages weren't going out on payment approval.
    if (statusChanged && ['seat_locked', 'confirmed', 'rejected'].includes(finalBookingStatus)) {
      try {
        await fetch(`${request.nextUrl.origin}/api/bookings/send-notification`, {
          method: 'POST',
          headers: internalFetchHeaders(),
          body: JSON.stringify({ bookingId, status: finalBookingStatus, rejectionReason }),
        });
      } catch (e) {
        console.error('review-payment-transaction: notify failed', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payment transaction ${status === 'verified' ? 'verified' : 'rejected'} successfully`,
      bookingId,
      bookingStatus: finalBookingStatus,
    });
  } catch (error: any) {
    console.error('Error in review payment transaction API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
