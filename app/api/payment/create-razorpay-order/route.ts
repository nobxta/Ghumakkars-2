import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Razorpay from 'razorpay';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayConfig } from '@/lib/razorpay';
import { payableNowOf } from '@/lib/booking-money';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, bookingId, tripId } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Only payment_mode (a non-secret feature flag) is read from DB.
    // Keys come from env vars via getRazorpayConfig() — never from the database.
    const adminClient = createAdminClient();

    if (bookingId) {
      const { data: booking, error: bookingError } = await adminClient
        .from('bookings')
        .select('id, user_id, payment_method, booking_status, number_of_participants, total_price, final_amount, coupon_discount, wallet_amount_used, waived_amount, addons_total, amount_paid, is_offline_booking, trips(discounted_price), payment_transactions(amount, payment_status, amount_refunded)')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      if ((booking as any).user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized booking' }, { status: 403 });
      }

      const expectedPayableNow = payableNowOf(booking as any, (booking as any).trips);
      if (Math.abs(Number(amount) - expectedPayableNow) > 1) {
        return NextResponse.json(
          { error: 'Payment amount mismatch. Please refresh the page and try again.' },
          { status: 400 }
        );
      }
    }
    const { data: paymentSettings } = await adminClient
      .from('payment_settings')
      .select('payment_mode')
      .limit(1)
      .single();

    if (!paymentSettings || paymentSettings.payment_mode !== 'razorpay') {
      return NextResponse.json({ error: 'Razorpay is not enabled in admin settings' }, { status: 400 });
    }

    let config;
    try {
      config = getRazorpayConfig();
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }

    const razorpay = new Razorpay({ key_id: config.key_id, key_secret: config.key_secret });

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: bookingId || `booking_${Date.now()}`,
      notes: {
        bookingId: bookingId || null,
        tripId: tripId || null,
        userId: user.id,
      },
    };

    const order = await razorpay.orders.create(options);

    // Store razorpay_order_id on booking so webhook can find it when it runs
    // before the client's verify-razorpay-payment (avoids "Booking not found" in webhook)
    if (bookingId) {
      await adminClient
        .from('bookings')
        .update({ razorpay_order_id: order.id })
        .eq('id', bookingId);
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.key_id,
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order' },
      { status: 500 }
    );
  }
}

