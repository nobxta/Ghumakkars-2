import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimBookingSeats } from '@/lib/booking-admin-sync';
import { markBookingAddonsPaid } from '@/lib/addons-server';
import { withErrorLog } from '@/lib/error-log';

export const runtime = 'nodejs';

/**
 * POST /api/bookings/confirm-zero-payment
 * Body: { bookingId: string }
 *
 * Used when wallet balance + coupon discount fully cover the trip cost.
 * Razorpay won't accept orders below ₹1, so we confirm the booking
 * directly and create a payment_transactions row marking it as 'wallet'.
 */
async function handlePOST(request: NextRequest) {
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
      .select('id, user_id, final_amount, total_price, wallet_amount_used, coupon_discount, trip_id, number_of_participants, payment_method, booking_status, addons_total')
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
    // Full payment collects add-ons now, so they must be ₹0 too — otherwise this
    // would mark unpaid add-ons as paid.
    const addonsDueNow = booking.payment_method === 'seat_lock' ? 0 : Number(booking.addons_total || 0);
    if (finalAmount + addonsDueNow >= 1) {
      return NextResponse.json(
        { error: `This endpoint is only for zero-amount bookings. Amount due is ₹${finalAmount + addonsDueNow}.` },
        { status: 400 }
      );
    }
    if (booking.booking_status === 'confirmed' || booking.booking_status === 'seat_locked') {
      return NextResponse.json({ success: true, alreadyConfirmed: true });
    }
    if (booking.booking_status !== 'pending') {
      return NextResponse.json({ error: 'This booking can no longer be confirmed.' }, { status: 400 });
    }

    // Confirm + add seats exactly once (a repeated call does nothing).
    const { claimed } = await claimBookingSeats(admin, bookingId, {
      payment_status: 'paid',
      amount_paid: 0,
      booking_status: booking.payment_method === 'seat_lock' ? 'seat_locked' : 'confirmed',
      payment_mode: 'wallet',
    });
    if (!claimed) {
      return NextResponse.json({ success: true, alreadyConfirmed: true });
    }

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

    if (booking.payment_method !== 'seat_lock') {
      await markBookingAddonsPaid(admin, bookingId).catch(() => {});
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

export const POST = withErrorLog('booking', 'Confirm ₹0 booking', handlePOST);
