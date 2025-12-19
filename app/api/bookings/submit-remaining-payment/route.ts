import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { bookingId, transactionId } = await request.json();

    if (!bookingId || !transactionId) {
      return NextResponse.json(
        { error: 'bookingId and transactionId are required' },
        { status: 400 }
      );
    }

    // Use admin client to fetch booking and verify ownership
    const adminClient = createAdminClient();
    
    // Fetch booking to verify user owns it
    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select('user_id, trips(discounted_price), number_of_participants, payment_amount, final_amount, payment_method')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Verify user owns this booking
    if (booking.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - You can only submit payments for your own bookings' },
        { status: 403 }
      );
    }

    // Calculate remaining amount
    const trip = booking.trips as any;
    const fullPrice = (trip?.discounted_price || 0) * (booking.number_of_participants || 1);
    const paidAmount = parseFloat(String(booking.payment_amount || booking.final_amount || 0));
    const remainingAmount = Math.max(0, fullPrice - paidAmount);

    if (remainingAmount <= 0) {
      return NextResponse.json(
        { error: 'No remaining payment required' },
        { status: 400 }
      );
    }

    // Get booking payment mode
    const { data: bookingDetails } = await adminClient
      .from('bookings')
      .select('payment_mode')
      .eq('id', bookingId)
      .single();

    // Create payment transaction using admin client
    const { error: transactionError } = await adminClient
      .from('payment_transactions')
      .insert([
        {
          booking_id: bookingId,
          transaction_id: transactionId.trim(),
          amount: remainingAmount,
          payment_type: 'remaining',
          payment_status: 'pending',
          payment_mode: bookingDetails?.payment_mode || 'manual', // Track payment mode
        },
      ]);

    if (transactionError) {
      console.error('Error creating payment transaction:', transactionError);
      return NextResponse.json(
        { error: transactionError.message || 'Failed to create payment transaction' },
        { status: 500 }
      );
    }

    // Update booking totals
    const newTotalPaid = paidAmount + remainingAmount;
    const { error: updateError } = await adminClient
      .from('bookings')
      .update({
        payment_amount: newTotalPaid,
        final_amount: newTotalPaid,
        total_price: fullPrice,
        payment_status: 'pending',
        booking_status: 'pending',
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update booking' },
        { status: 500 }
      );
    }

    // Send notification email
    try {
      const { data: bookingData } = await adminClient
        .from('bookings')
        .select('primary_passenger_email, primary_passenger_name, trips(title, destination, start_date, end_date)')
        .eq('id', bookingId)
        .single();

      if (bookingData) {
        await fetch(`${request.nextUrl.origin}/api/bookings/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: bookingId,
            status: 'pending',
            tripDetails: bookingData.trips,
            userEmail: bookingData.primary_passenger_email,
            userName: bookingData.primary_passenger_name,
          }),
        });
      }
    } catch (emailError) {
      console.error('Error sending notification email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Remaining payment submitted successfully',
    });
  } catch (error: any) {
    console.error('Error in submit remaining payment API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

