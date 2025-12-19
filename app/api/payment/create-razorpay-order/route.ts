import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Razorpay from 'razorpay';
import { createAdminClient } from '@/lib/supabase/admin';

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

    // Fetch payment settings to get Razorpay keys
    const adminClient = createAdminClient();
    const { data: paymentSettings, error: settingsError } = await adminClient
      .from('payment_settings')
      .select('razorpay_key_id, razorpay_key_secret, payment_mode')
      .limit(1)
      .single();

    if (settingsError || !paymentSettings || paymentSettings.payment_mode !== 'razorpay') {
      return NextResponse.json({ error: 'Razorpay is not configured' }, { status: 400 });
    }

    if (!paymentSettings.razorpay_key_id || !paymentSettings.razorpay_key_secret) {
      return NextResponse.json({ error: 'Razorpay keys are not configured' }, { status: 400 });
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: paymentSettings.razorpay_key_id,
      key_secret: paymentSettings.razorpay_key_secret,
    });

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

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: paymentSettings.razorpay_key_id,
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order' },
      { status: 500 }
    );
  }
}

