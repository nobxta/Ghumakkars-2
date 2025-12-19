import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { bookingId, amountPaid, notes } = await request.json();

    if (!bookingId || !amountPaid || amountPaid <= 0) {
      return NextResponse.json({ error: 'Booking ID and valid amount are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch booking
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select('id, final_amount, payment_mode, payment_status, booking_status')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.payment_mode !== 'cash') {
      return NextResponse.json({ error: 'This booking is not a cash payment' }, { status: 400 });
    }

    // Update booking with cash payment approval
    const updateData: any = {
      payment_status: 'paid',
      amount_paid: parseFloat(amountPaid),
      booking_status: parseFloat(amountPaid) >= parseFloat(String(booking.final_amount || 0)) ? 'confirmed' : 'seat_locked',
      reference_id: `CASH_${Date.now()}`,
      payment_reviewed_at: new Date().toISOString(),
      payment_reviewed_by: user.id,
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

    // Create payment transaction
    await adminClient
      .from('payment_transactions')
      .insert([
        {
          booking_id: bookingId,
          transaction_id: updateData.reference_id,
          amount: parseFloat(amountPaid),
          payment_type: 'full',
          payment_status: 'verified',
          payment_mode: 'cash', // Track payment mode
        },
      ]);

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

    // Send notification
    try {
      await fetch(`${request.nextUrl.origin}/api/bookings/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingId,
          status: updateData.booking_status,
        }),
      });
    } catch (emailError) {
      console.error('Error sending notification:', emailError);
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

