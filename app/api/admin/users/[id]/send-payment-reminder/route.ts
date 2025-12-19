import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPaymentReminderEmail } from '@/lib/email';

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin access
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const userId = params.id;
    const { bookingId } = await request.json();

    const adminClient = createAdminClient();

    // Fetch user profile
    const { data: userProfile, error: userError } = await adminClient
      .from('profiles')
      .select('email, full_name, first_name')
      .eq('id', userId)
      .single();

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select(`
        *,
        trips (
          id,
          title,
          destination,
          start_date,
          end_date
        ),
        payment_transactions (*)
      `)
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Calculate remaining amount
    const totalPaid = booking.payment_transactions
      ?.filter((pt: any) => pt.payment_status === 'verified')
      .reduce((sum: number, pt: any) => sum + parseFloat(String(pt.amount || 0)), 0) || 0;

    const remainingAmount = parseFloat(String(booking.final_amount || booking.total_price || 0)) - totalPaid;

    if (remainingAmount <= 0) {
      return NextResponse.json({ error: 'No remaining payment for this booking' }, { status: 400 });
    }

    // Calculate due date (5 days before trip start)
    const tripStartDate = booking.trips?.start_date ? new Date(booking.trips.start_date) : null;
    const dueDate = tripStartDate ? new Date(tripStartDate.getTime() - 5 * 24 * 60 * 60 * 1000) : null;

    // Log the activity
    await adminClient
      .from('admin_activity_log')
      .insert({
        user_id: userId,
        admin_id: user.id,
        action_type: 'reminder_sent',
        action_description: `Sent payment reminder for booking "${booking.trips?.title || 'Trip'}" - Remaining: ₹${remainingAmount.toLocaleString()}`,
        metadata: {
          booking_id: booking.id,
          trip_title: booking.trips?.title,
          remaining_amount: remainingAmount,
          due_date: dueDate?.toISOString()
        }
      });

    // Send email
    try {
      await sendPaymentReminderEmail(
        userProfile.email,
        userProfile.full_name || userProfile.first_name || 'User',
        {
          bookingId: booking.id,
          tripTitle: booking.trips?.title || 'Trip',
          destination: booking.trips?.destination || 'N/A',
          startDate: booking.trips?.start_date || '',
          remainingAmount: remainingAmount,
          dueDate: dueDate?.toISOString() || '',
        }
      );

      return NextResponse.json({ 
        success: true,
        message: 'Payment reminder sent successfully'
      });
    } catch (emailError: any) {
      console.error('Error sending payment reminder email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send email: ' + emailError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending payment reminder:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

