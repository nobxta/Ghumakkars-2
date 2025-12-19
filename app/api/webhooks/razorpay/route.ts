import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Get webhook signature from headers
    const signature = request.headers.get('X-Razorpay-Signature');
    
    if (!signature) {
      console.error('Missing Razorpay signature in webhook request');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Get raw body for signature verification
    const body = await request.text();
    const webhookBody = JSON.parse(body);

    // Fetch payment settings to get webhook secret
    const adminClient = createAdminClient();
    const { data: paymentSettings, error: settingsError } = await adminClient
      .from('payment_settings')
      .select('razorpay_webhook_secret')
      .limit(1)
      .single();

    if (settingsError || !paymentSettings?.razorpay_webhook_secret) {
      console.error('Webhook secret not configured:', settingsError);
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', paymentSettings.razorpay_webhook_secret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Handle different webhook events
    const event = webhookBody.event;
    const payload = webhookBody.payload;

    console.log('Razorpay webhook received:', event);

    switch (event) {
      case 'payment.captured':
      case 'payment.authorized':
        await handlePaymentSuccess(payload.payment.entity, adminClient);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity, adminClient);
        break;

      case 'order.paid':
        // Order fully paid - handle if needed
        if (payload.order?.entity) {
          await handleOrderPaid(payload.order.entity, adminClient);
        }
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing Razorpay webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(payment: any, adminClient: any) {
  try {
    const razorpayPaymentId = payment.id;
    const razorpayOrderId = payment.order_id;
    const amount = payment.amount / 100; // Convert from paise to rupees

    // Find booking by razorpay_payment_id or razorpay_order_id
    const { data: bookings, error: bookingError } = await adminClient
      .from('bookings')
      .select('id, final_amount, payment_method, trip_id, number_of_participants, booking_status, payment_status')
      .or(`razorpay_payment_id.eq.${razorpayPaymentId},razorpay_order_id.eq.${razorpayOrderId}`)
      .limit(1);

    const booking = bookings?.[0];

    if (bookingError || !booking) {
      console.error('Booking not found for payment:', razorpayPaymentId, bookingError);
      return;
    }

    // Check if payment is already processed
    if (booking.booking_status === 'confirmed' || booking.payment_status === 'paid') {
      console.log('Payment already processed for booking:', booking.id);
      return;
    }

    // Update booking
    const updateData: any = {
      payment_status: 'paid',
      amount_paid: amount,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_order_id: razorpayOrderId,
      razorpay_response: payment,
      booking_status: 'confirmed',
      reference_id: razorpayPaymentId,
    };

    const { error: updateError } = await adminClient
      .from('bookings')
      .update(updateData)
      .eq('id', booking.id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return;
    }

    // Create or update payment transaction
    const { data: existingTransaction } = await adminClient
      .from('payment_transactions')
      .select('id')
      .eq('booking_id', booking.id)
      .eq('transaction_id', razorpayPaymentId)
      .single();

    if (existingTransaction) {
      // Update existing transaction
      await adminClient
        .from('payment_transactions')
        .update({
          payment_status: 'verified',
          amount: amount,
        })
        .eq('id', existingTransaction.id);
    } else {
      // Create new transaction
      await adminClient
        .from('payment_transactions')
        .insert([
          {
            booking_id: booking.id,
            transaction_id: razorpayPaymentId,
            amount: amount,
            payment_type: booking.payment_method === 'seat_lock' ? 'seat_lock' : 'full',
            payment_status: 'verified',
          },
        ]);
    }

    // Increment trip participants
    if (booking.trip_id) {
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
    }

    // Send confirmation email
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/bookings/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          status: 'confirmed',
        }),
      });
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
    }

    console.log('Payment success processed for booking:', booking.id);
  } catch (error: any) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailed(payment: any, adminClient: any) {
  try {
    const razorpayPaymentId = payment.id;
    const razorpayOrderId = payment.order_id;

    // Find booking
    const { data: bookings, error: bookingError } = await adminClient
      .from('bookings')
      .select('id, booking_status, payment_status')
      .or(`razorpay_payment_id.eq.${razorpayPaymentId},razorpay_order_id.eq.${razorpayOrderId}`)
      .limit(1);

    const booking = bookings?.[0];

    if (bookingError || !booking) {
      console.error('Booking not found for failed payment:', razorpayPaymentId);
      return;
    }

    // Only update if booking is still pending
    if (booking.booking_status === 'pending') {
      await adminClient
        .from('bookings')
        .update({
          payment_status: 'failed',
          razorpay_response: payment,
        })
        .eq('id', booking.id);

      console.log('Payment failed processed for booking:', booking.id);
    }
  } catch (error: any) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleOrderPaid(order: any, adminClient: any) {
  // Handle order.paid event if needed
  // This event is triggered when all payments for an order are captured
  console.log('Order paid event received:', order.id);
}

