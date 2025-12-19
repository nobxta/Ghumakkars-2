import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    // Verify user is admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { bookingId, status, reviewNotes, rejectionReason } = await request.json();

    if (!bookingId || !status) {
      return NextResponse.json(
        { error: 'bookingId and status are required' },
        { status: 400 }
      );
    }

    if (status === 'rejected' && !rejectionReason) {
      return NextResponse.json(
        { error: 'rejectionReason is required when rejecting payment' },
        { status: 400 }
      );
    }

    // Use admin client to update booking (bypasses RLS)
    const adminClient = createAdminClient();

    // Fetch booking first to get trip_id, number_of_participants, and payment_method
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select('trip_id, number_of_participants, transaction_id, payment_method')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      payment_status: status,
      payment_reviewed_at: new Date().toISOString(),
      payment_reviewed_by: user.id,
      payment_review_notes: reviewNotes || null,
    };

    // If payment is verified, update booking status based on payment method
    if (status === 'verified') {
      if (!booking.transaction_id) {
        return NextResponse.json(
          { error: 'No transaction ID available to verify' },
          { status: 400 }
        );
      }
      // Set booking status based on payment method
      // Seat lock payments -> 'seat_locked', Full payments -> 'confirmed'
      if (booking.payment_method === 'seat_lock') {
        updateData.booking_status = 'seat_locked';
      } else {
        updateData.booking_status = 'confirmed';
      }
    } else if (status === 'rejected') {
      updateData.booking_status = 'rejected';
      updateData.rejection_reason = rejectionReason;
    }

    // Update booking
    const { error: updateError } = await adminClient
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update booking' },
        { status: 500 }
      );
    }

    // If payment is verified, increment trip participants
    if (status === 'verified' && booking.trip_id) {
      try {
        // Fetch current participants
        const { data: trip, error: tripFetchError } = await adminClient
          .from('trips')
          .select('current_participants')
          .eq('id', booking.trip_id)
          .single();

        if (!tripFetchError && trip) {
          // Update participants
          const { error: tripUpdateError } = await adminClient
            .from('trips')
            .update({
              current_participants: (trip.current_participants || 0) + (booking.number_of_participants || 1),
              updated_at: new Date().toISOString(),
            })
            .eq('id', booking.trip_id);

          if (tripUpdateError) {
            console.error('Error updating trip participants:', tripUpdateError);
            // Don't fail the whole request if trip update fails
          }
        }
      } catch (tripError) {
        console.error('Error incrementing trip participants:', tripError);
        // Don't fail the whole request if trip update fails
      }

      // Process referral reward if this is user's first confirmed booking
      try {
        const { data: bookingUser } = await adminClient
          .from('bookings')
          .select('user_id')
          .eq('id', bookingId)
          .single();

        if (bookingUser && (status === 'verified' || status === 'paid')) {
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
    }

    // Fetch updated booking to get the new booking_status
    const { data: updatedBooking } = await adminClient
      .from('bookings')
      .select('booking_status, payment_method')
      .eq('id', bookingId)
      .single();

    return NextResponse.json({
      success: true,
      message: `Payment ${status === 'verified' ? 'verified' : 'rejected'} successfully`,
      bookingStatus: updatedBooking?.booking_status || 'pending',
    });
  } catch (error: any) {
    console.error('Error in review payment API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


