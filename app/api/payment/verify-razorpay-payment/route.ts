import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Razorpay from 'razorpay';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

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

    // Fetch payment settings
    const adminClient = createAdminClient();
    const { data: paymentSettings, error: settingsError } = await adminClient
      .from('payment_settings')
      .select('razorpay_key_id, razorpay_key_secret')
      .limit(1)
      .single();

    if (settingsError || !paymentSettings?.razorpay_key_secret) {
      return NextResponse.json({ error: 'Payment configuration error' }, { status: 500 });
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', paymentSettings.razorpay_key_secret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // Fetch payment details from Razorpay
    const razorpay = new Razorpay({
      key_id: paymentSettings.razorpay_key_id,
      key_secret: paymentSettings.razorpay_key_secret,
    });

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
          booking_status: 'confirmed',
        })
        .eq('id', bookingId);

      // Create payment transaction
      const booking = existingBooking;
      await adminClient
        .from('payment_transactions')
        .insert([
          {
            booking_id: bookingId,
            transaction_id: razorpay_payment_id,
            amount: amountInRupees,
            payment_type: booking.payment_method === 'seat_lock' ? 'seat_lock' : 'full',
            payment_status: 'verified',
            payment_mode: 'razorpay',
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

