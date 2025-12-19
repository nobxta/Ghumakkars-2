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
      .select('*, bookings(trip_id, number_of_participants, payment_method)')
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
        payment_reviewed_by: user.id,
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
      .select('payment_status, payment_type')
      .eq('booking_id', bookingId);

    if (!paymentsError && allPayments) {
      const allVerified = allPayments.every(p => p.payment_status === 'verified');
      const hasRejected = allPayments.some(p => p.payment_status === 'rejected');
      
      // Fetch booking to get current state
      const { data: bookingData } = await adminClient
        .from('bookings')
        .select('payment_method, payment_amount, trips(discounted_price)')
        .eq('id', bookingId)
        .single();

      let bookingStatus = 'pending';
      
      if (hasRejected) {
        bookingStatus = 'rejected';
      } else if (allVerified) {
        // All payments verified - check if it's full payment or seat lock
        const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(String(p.payment_status === 'verified' ? bookingData?.payment_amount : 0)), 0);
        const fullPrice = (bookingData?.trips?.discounted_price || 0) * (booking?.number_of_participants || 1);
        
        if (booking?.payment_method === 'seat_lock' && totalPaid < fullPrice) {
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
      if (allVerified && bookingStatus === 'confirmed' && booking.trip_id) {
        try {
          // Check if already incremented (to avoid double counting)
          const { data: trip } = await adminClient
            .from('trips')
            .select('current_participants')
            .eq('id', booking.trip_id)
            .single();

          if (trip) {
            // Only increment if not already done for this booking
            // We'll use a flag or check if needed, for now just increment
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

