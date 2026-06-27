import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateTripById } from '@/lib/revalidate-trips';

export const runtime = 'nodejs';

/**
 * POST /api/bookings/confirm-zero-payment
 * Body: { bookingId: string }
 *
 * Used when wallet balance + coupon discount fully cover the trip cost.
 * Razorpay won't accept orders below ₹1, so we confirm the booking
 * directly and create a payment_transactions row marking it as 'wallet'.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId } = await request.json();
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: booking, error: fetchErr } = await admin
      .from('bookings')
      .select('id, user_id, final_amount, total_price, wallet_amount_used, coupon_discount, trip_id, number_of_participants, payment_method, booking_status')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only confirm your own booking' }, { status: 403 });
    }

    const finalAmount = Number(booking.final_amount || 0);
    if (finalAmount >= 1) {
      return NextResponse.json(
        { error: `This endpoint is only for zero-amount bookings. Final amount is ₹${finalAmount}.` },
        { status: 400 }
      );
    }
    if (booking.booking_status === 'confirmed') {
      return NextResponse.json({ success: true, alreadyConfirmed: true });
    }

    // Mark booking as confirmed
    await admin
      .from('bookings')
      .update({
        payment_status: 'paid',
        amount_paid: 0,
        booking_status: booking.payment_method === 'seat_lock' ? 'seat_locked' : 'confirmed',
        payment_mode: 'wallet',
      })
      .eq('id', bookingId);

    // Create a transaction record so it shows up in payment timelines
    const txId = `WALLET-${Date.now().toString(36).toUpperCase()}`;
    await admin
      .from('payment_transactions')
      .insert([{
        booking_id: bookingId,
        user_id: user.id,
        transaction_id: txId,
        amount: 0,
        currency: 'INR',
        payment_type: booking.payment_method === 'seat_lock' ? 'seat_lock' : 'full',
        payment_status: 'verified',
        payment_mode: 'wallet',
        payment_method: 'wallet',
        captured: true,
        paid_at: new Date().toISOString(),
      }]);

    // Increment trip participants count
    if (booking.trip_id) {
      const { data: trip } = await admin
        .from('trips')
        .select('current_participants')
        .eq('id', booking.trip_id)
        .single();
      if (trip) {
        await admin
          .from('trips')
          .update({
            current_participants: (trip.current_participants || 0) + (booking.number_of_participants || 1),
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.trip_id);
      }
      // Zero-payment confirmation took a seat — refresh public pages now.
      await revalidateTripById(booking.trip_id);
    }

    // Process referral reward if this is user's first confirmed booking
    try {
      const { count: previousBookings } = await admin
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('booking_status', ['confirmed', 'seat_locked'])
        .neq('id', bookingId);
      if (previousBookings === 0) {
        await admin.rpc('process_referral_reward', { p_booking_id: bookingId });
      }
    } catch (e) {
      console.error('Referral reward processing failed:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error confirming zero-payment booking:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to confirm booking' },
      { status: 500 }
    );
  }
}
