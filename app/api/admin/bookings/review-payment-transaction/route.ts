import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { transactionId, status, reviewNotes, rejectionReason } = await request.json();

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
        payment_reviewed_by: auth.user.id,
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

    // Check if all payments for this booking are verified
    const { data: allPayments, error: paymentsError } = await adminClient
      .from('payment_transactions')
      .select('payment_status, payment_type, amount')
      .eq('booking_id', bookingId);

    if (!paymentsError && allPayments) {
      const allVerified = allPayments.every(p => p.payment_status === 'verified');
      const hasRejected = allPayments.some(p => p.payment_status === 'rejected');

      // Fetch booking to get the true amount owed (final_amount already includes
      // coupon/wallet discounts; fall back to discounted_price × pax).
      const { data: bookingData } = await adminClient
        .from('bookings')
        .select('payment_method, final_amount, total_price, coupon_discount, wallet_amount_used, number_of_participants, trips(discounted_price)')
        .eq('id', bookingId)
        .single();

      let bookingStatus = 'pending';

      if (hasRejected) {
        bookingStatus = 'rejected';
      } else if (allVerified) {
        // Sum the ACTUAL verified transaction amounts (not the booking field).
        const totalPaid = allPayments
          .filter(p => p.payment_status === 'verified')
          .reduce((sum, p) => sum + parseFloat(String(p.amount || 0)), 0);

        // Supabase returns a to-one relation as an object (sometimes an array).
        const tripsRel: any = (bookingData as any)?.trips;
        const trip = Array.isArray(tripsRel) ? tripsRel[0] : tripsRel;
        const pax = Number((bookingData as any)?.number_of_participants || booking?.number_of_participants || 1);
        // Full trip cost AFTER the customer's discounts = total_price − coupon − wallet.
        // (Falls back to list price × pax.) For seat-lock bookings final_amount is
        // only the DEPOSIT, so we must compare paid against this discount-adjusted
        // full cost — matches the admin-side remaining-amount calculation.
        const gross = Number((bookingData as any)?.total_price || 0) || Number(trip?.discounted_price || 0) * pax;
        const coupon = Number((bookingData as any)?.coupon_discount || 0);
        const wallet = Number((bookingData as any)?.wallet_amount_used || 0);
        const fullPrice = Math.max(0, gross - coupon - wallet);

        // A seat-lock booking stays "seat_locked" until the full trip cost is
        // paid; only then does it become "confirmed".
        const method = (bookingData as any)?.payment_method || booking?.payment_method;
        if (method === 'seat_lock' && fullPrice > 0 && totalPaid < fullPrice - 1) {
          bookingStatus = 'seat_locked';
        } else {
          bookingStatus = 'confirmed';
        }
      }

      // Update booking status
      await adminClient
        .from('bookings')
        .update({
          booking_status: bookingStatus,
          payment_status: allVerified ? 'verified' : hasRejected ? 'rejected' : 'pending',
        })
        .eq('id', bookingId);

      // If all payments verified and booking is confirmed, increment trip participants
      if (allVerified && (bookingStatus === 'confirmed' || bookingStatus === 'seat_locked') && booking.trip_id) {
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

    return NextResponse.json({
      success: true,
      message: `Payment transaction ${status === 'verified' ? 'verified' : 'rejected'} successfully`,
    });
  } catch (error: any) {
    console.error('Error in review payment transaction API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

