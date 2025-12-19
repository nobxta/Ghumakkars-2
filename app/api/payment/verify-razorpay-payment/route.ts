import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Razorpay from 'razorpay';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

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

    // Update booking with payment details
    if (bookingId) {
      const paymentAmount = typeof payment.amount === 'number' ? payment.amount : parseInt(String(payment.amount || 0));
      const amountInRupees = paymentAmount / 100; // Convert from paise to rupees

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
      const { data: booking } = await adminClient
        .from('bookings')
        .select('final_amount, payment_method, user_id')
        .eq('id', bookingId)
        .single();

      if (booking) {
        await adminClient
          .from('payment_transactions')
          .insert([
            {
              booking_id: bookingId,
              transaction_id: razorpay_payment_id,
              amount: amountInRupees,
              payment_type: booking.payment_method === 'seat_lock' ? 'seat_lock' : 'full',
              payment_status: 'verified',
              payment_mode: 'razorpay', // Track payment mode
            },
          ]);

        // Process referral reward if this is user's first confirmed booking
        try {
          // Check if this is first confirmed booking
          const { count: previousBookings } = await adminClient
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', booking.user_id)
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
        } catch (referralError) {
          console.error('Error processing referral reward:', referralError);
          // Don't fail the whole request if referral processing fails
        }
      }
    }

    const paymentAmount = typeof payment.amount === 'number' ? payment.amount : parseInt(String(payment.amount || 0));
    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
      amount: paymentAmount / 100,
    });
  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
}

