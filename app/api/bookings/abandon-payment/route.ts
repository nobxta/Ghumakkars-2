import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Mark a Razorpay pending booking as abandoned/cancelled when user closes
 * the payment window without paying or when payment times out.
 * Keeps abandoned attempts out of the main booking list (no spam).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const bookingId = body?.bookingId ?? body?.booking_id;
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: booking, error: fetchError } = await adminClient
      .from('bookings')
      .select('id, user_id, booking_status, payment_status, payment_mode, razorpay_payment_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only abandon your own booking' }, { status: 403 });
    }

    // Only cancel if still pending and not paid (no razorpay_payment_id means they never completed payment)
    const isPending = booking.booking_status === 'pending';
    const isRazorpay = booking.payment_mode === 'razorpay';
    const notPaid = booking.payment_status !== 'paid' && !booking.razorpay_payment_id;

    if (!isPending || !isRazorpay || !notPaid) {
      return NextResponse.json(
        { success: true, message: 'Booking already processed or not eligible for abandon' }
      );
    }

    const { error: updateError } = await adminClient
      .from('bookings')
      .update({
        booking_status: 'cancelled',
        payment_status: 'failed',
        rejection_reason: 'Payment not completed (window closed or timed out).',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error marking booking as abandoned:', updateError);
      return NextResponse.json(
        { error: 'Failed to update booking' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Booking marked as payment failed.',
    });
  } catch (error: any) {
    console.error('Error in abandon-payment:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
