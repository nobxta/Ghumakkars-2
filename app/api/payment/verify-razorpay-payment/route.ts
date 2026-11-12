import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Razorpay from 'razorpay';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';
import { getRazorpayConfig } from '@/lib/razorpay';
import { claimBookingSeats } from '@/lib/booking-admin-sync';
import { markBookingAddonsPaid } from '@/lib/addons-server';
import { derivePaymentStatus, owedOf, payableNowOf } from '@/lib/booking-money';
import { withErrorLog } from '@/lib/error-log';

export const runtime = "nodejs";

async function handlePOST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    // Keys come from env vars — never from the database.
    const adminClient = createAdminClient();
    let config;
    try {
      config = getRazorpayConfig();
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', config.key_secret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // Fetch payment details from Razorpay
    const razorpay = new Razorpay({ key_id: config.key_id, key_secret: config.key_secret });

    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
    }

    const paymentAmount = typeof payment.amount === 'number' ? payment.amount : parseInt(String(payment.amount || 0));
    const amountInRupees = paymentAmount / 100; // Convert from paise to rupees

    // Update booking with payment details (only if bookingId provided)
    if (bookingId) {
      // 1. Verify booking exists and belongs to the authenticated user
      const { data: existingBooking, error: fetchBookingError } = await adminClient
        .from('bookings')
        .select('id, user_id, razorpay_order_id, razorpay_payment_id, final_amount, total_price, coupon_discount, wallet_amount_used, addons_total, waived_amount, amount_paid, payment_method, booking_status, trip_id, number_of_participants, trips(discounted_price), payment_transactions(amount, payment_status, amount_refunded)')
        .eq('id', bookingId)
        .single();

      if (fetchBookingError || !existingBooking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      if (existingBooking.user_id !== user.id) {
        return NextResponse.json(
          { error: 'You can only confirm payment for your own booking' },
          { status: 403 }
        );
      }

      // 2. The payment must belong to the Razorpay order that was created for
      // THIS booking. Without this, one real payment could be replayed to
      // confirm any other booking of the same or lower price.
      if (
        (payment as any).order_id !== razorpay_order_id ||
        !(existingBooking as any).razorpay_order_id ||
        (existingBooking as any).razorpay_order_id !== razorpay_order_id
      ) {
        return NextResponse.json(
          { error: 'This payment does not belong to this booking' },
          { status: 400 }
        );
      }

      // Already recorded (webhook got here first, or this is a replay): don't
      // touch the booking again — it may have been cancelled by an admin since.
      if ((existingBooking as any).razorpay_payment_id === razorpay_payment_id) {
        return NextResponse.json({ success: true, alreadyProcessed: true, paymentId: razorpay_payment_id, amount: amountInRupees });
      }

      // 3. Verify payment amount against the amount due for this attempt, not
      // always against the grand total. Full payment includes add-ons; seat-lock
      // only collects the deposit and leaves add-ons in the remaining balance.
      const expectedAmount = payableNowOf(existingBooking as any, (existingBooking as any).trips);
      if (expectedAmount > 0 && amountInRupees < expectedAmount - 0.01) {
        return NextResponse.json(
          { error: 'Payment amount does not match booking amount' },
          { status: 400 }
        );
      }

      const owed = owedOf(existingBooking as any, (existingBooking as any).trips);
      const paymentStatus = derivePaymentStatus(amountInRupees, owed, false);
      const bookingStatus = existingBooking.payment_method === 'seat_lock' ? 'seat_locked' : 'confirmed';

      // Confirm the booking and add its seats — but only if nobody (the webhook,
      // or an earlier/replayed call) has already done so.
      const { claimed } = await claimBookingSeats(adminClient, bookingId, {
        payment_mode: 'razorpay',
        payment_status: paymentStatus,
        amount_paid: amountInRupees,
        reference_id: razorpay_payment_id,
        razorpay_order_id: razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id,
        razorpay_response: payment as any,
        booking_status: bookingStatus,
      });
      if (!claimed) {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          paymentId: razorpay_payment_id,
          amount: amountInRupees,
        });
      }

      // Create payment transaction with full Razorpay payment data
      const booking = existingBooking;
      const p: any = payment;
      const acquirer = p.acquirer_data || {};
      const transactionPayload = {
        booking_id: bookingId,
        user_id: user.id,
        transaction_id: razorpay_payment_id,
        razorpay_order_id,
        razorpay_payment_id,
        amount: amountInRupees,
        currency: p.currency || 'INR',
        payment_type: booking.payment_method === 'seat_lock' ? 'seat_lock' : 'full',
        payment_status: 'verified',
        payment_mode: 'razorpay',
        payment_method: p.method || null,
        captured: !!p.captured,
        vpa: p.vpa || null,
        upi_provider: acquirer.upi_provider || null,
        card_network: p.card?.network || null,
        card_type: p.card?.type || null,
        card_last4: p.card?.last4 || null,
        card_issuer: p.card?.issuer || null,
        bank: p.bank || null,
        wallet: p.wallet || null,
        customer_name: p.notes?.name || null,
        customer_email: p.email || null,
        customer_phone: p.contact || null,
        paid_at: p.created_at ? new Date(p.created_at * 1000).toISOString() : new Date().toISOString(),
        razorpay_raw: p,
      };
      const { data: existingTransaction } = await adminClient
        .from('payment_transactions')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('transaction_id', razorpay_payment_id)
        .maybeSingle();

      if (existingTransaction) {
        await adminClient
          .from('payment_transactions')
          .update(transactionPayload)
          .eq('id', existingTransaction.id);
      } else {
        await adminClient
          .from('payment_transactions')
          .insert([transactionPayload]);
      }

      // Full payment settles the add-ons too; seat-lock leaves them in the balance.
      if (booking.payment_method !== 'seat_lock') {
        await markBookingAddonsPaid(adminClient, bookingId).catch(() => {});
      }

      // (Seats were already added by claimBookingSeats above.)

      // Process referral reward if this is user's first confirmed booking
      try {
        const { count: previousBookings } = await adminClient
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', booking.user_id)
          .in('booking_status', ['confirmed', 'seat_locked'])
          .neq('id', bookingId);

        if (previousBookings === 0) {
          const { data: result, error: referralError } = await adminClient.rpc('process_referral_reward', {
            p_booking_id: bookingId
          });

          if (referralError) {
            console.error('Error processing referral reward:', referralError);
          } else if (result) {
            console.log('Referral reward processed successfully for booking:', bookingId);
          }
        }
      } catch (referralError) {
        console.error('Error processing referral reward:', referralError);
      }
    }

    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
      amount: amountInRupees,
    });
  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
}

export const POST = withErrorLog('payment', 'Verify Razorpay payment', handlePOST);
