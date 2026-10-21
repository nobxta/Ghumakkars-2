import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, internalFetchHeaders } from '@/lib/auth-helpers';
import { adjustTripSeats, seatDelta, syncBookingPaymentMirrors } from '@/lib/booking-admin-sync';
import { withErrorLog } from '@/lib/error-log';

export const runtime = "nodejs";

async function handlePOST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { bookingId, amountPaid, notes } = await request.json();

    if (!bookingId || !amountPaid || amountPaid <= 0) {
      return NextResponse.json({ error: 'Booking ID and valid amount are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch booking
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select('id, trip_id, payment_method, payment_mode, payment_status, booking_status, number_of_participants')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.payment_mode !== 'cash') {
      return NextResponse.json({ error: 'This booking is not a cash payment' }, { status: 400 });
    }

    // Record the cash money in the ledger (authoritative).
    const referenceId = `CASH_${Date.now()}`;
    const { error: insertError } = await adminClient
      .from('payment_transactions')
      .insert([
        {
          booking_id: bookingId,
          transaction_id: referenceId,
          amount: parseFloat(amountPaid),
          payment_type: 'offline',
          payment_status: 'verified',
          payment_mode: 'cash',
          payment_reviewed_at: new Date().toISOString(),
          payment_reviewed_by: auth.user.id,
          payment_review_notes: notes || null,
        },
      ]);

    if (insertError) {
      console.error('Error recording cash payment:', insertError);
      return NextResponse.json({ error: insertError.message || 'Failed to record cash payment' }, { status: 500 });
    }

    // Payment Status is DERIVED from the whole ledger (so a second cash instalment
    // adds to the first instead of replacing it). Booking Status is independent:
    // we only activate a brand-new (pending) booking.
    const money = await syncBookingPaymentMirrors(adminClient, bookingId);
    const newPaymentStatus = money?.status || 'partial';
    const activated = booking.booking_status === 'pending';
    const newBookingStatus = activated
      ? (newPaymentStatus === 'paid' && booking.payment_method !== 'seat_lock' ? 'confirmed' : 'seat_locked')
      : booking.booking_status;

    const updateData: any = {
      booking_status: newBookingStatus,
      reference_id: referenceId,
      payment_reviewed_at: new Date().toISOString(),
      payment_reviewed_by: auth.user.id,
      payment_review_notes: notes || null,
    };

    const { error: updateError } = await adminClient
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return NextResponse.json({ error: updateError.message || 'Failed to approve cash payment' }, { status: 500 });
    }

    // Activation takes seats on the trip.
    if (activated) {
      try {
        await adjustTripSeats(adminClient, booking.trip_id, seatDelta(booking.booking_status, newBookingStatus, Number(booking.number_of_participants) || 1));
      } catch (tripError) {
        console.error('Error updating trip participants:', tripError);
      }
    }

    // Process referral reward if this is user's first confirmed booking
    try {
      const { data: bookingUser } = await adminClient
        .from('bookings')
        .select('user_id')
        .eq('id', bookingId)
        .single();

      if (bookingUser && (updateData.booking_status === 'confirmed' || updateData.booking_status === 'seat_locked')) {
        // Check if this is first confirmed booking
        const { count: previousBookings } = await adminClient
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', bookingUser.user_id)
          .in('booking_status', ['confirmed', 'seat_locked'])
          .neq('id', bookingId);

        if (previousBookings === 0) {
          // This is first booking - process referral reward
          const { data: result, error: referralError } = await adminClient.rpc('process_referral_reward', {
            p_booking_id: bookingId
          });
          
          if (referralError) {
            console.error('Error processing referral reward:', referralError);
          } else if (result) {
            console.log('Referral reward processed successfully for booking:', bookingId);
          } else {
            console.log('Referral reward processing returned false for booking:', bookingId);
          }
        }
      }
    } catch (referralError) {
      console.error('Error processing referral reward:', referralError);
      // Don't fail the whole request if referral processing fails
    }

    // Notify only when the booking actually activated (pending → seat_locked).
    if (activated) {
      try {
        await fetch(`${request.nextUrl.origin}/api/bookings/send-notification`, {
          method: 'POST',
          headers: internalFetchHeaders(),
          body: JSON.stringify({ bookingId, status: newBookingStatus }),
        });
      } catch (emailError) {
        console.error('Error sending notification:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cash payment approved successfully',
      bookingStatus: updateData.booking_status,
    });
  } catch (error: any) {
    console.error('Error approving cash payment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withErrorLog('admin', 'Approve cash payment', handlePOST);
