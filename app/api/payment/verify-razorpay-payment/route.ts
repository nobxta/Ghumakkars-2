import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Razorpay from 'razorpay';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';
import { getRazorpayConfig } from '@/lib/razorpay';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
        .select('id, user_id, final_amount, payment_method, trip_id, number_of_participants')
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

      // 2. Optional: verify payment amount is at least the booking amount (allow small rounding)
      const expectedAmount = parseFloat(String(existingBooking.final_amount ?? 0));
      if (expectedAmount > 0 && amountInRupees < expectedAmount - 0.01) {
        return NextResponse.json(
          { error: 'Payment amount does not match booking amount' },
          { status: 400 }
        );
      }

      await adminClient
        .from('bookings')
        .update({
          payment_mode: 'razorpay',
          payment_status: 'paid',
          amount_paid: amountInRupees,
          reference_id: razorpay_payment_id,
          razorpay_order_id: razorpay_order_id,
          razorpay_payment_id: razorpay_payment_id,
          razorpay_response: payment as any,
          booking_status: existingBooking.payment_method === 'seat_lock' ? 'seat_locked' : 'confirmed',
        })
        .eq('id', bookingId);

      // Create payment transaction with full Razorpay payment data
      const booking = existingBooking;
      const p: any = payment;
      const acquirer = p.acquirer_data || {};
      await adminClient
        .from('payment_transactions')
        .insert([
          {
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
          },
        ]);

      // 3. Increment trip participants (same logic as webhook)
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

