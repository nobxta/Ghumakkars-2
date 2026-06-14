import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { sendPaymentReminderEmail } from '@/lib/email';

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

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
          end_date,
          payment_due_days_before
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

    // Calculate due date: per-trip override -> global setting -> 5 days before.
    const { resolveDueDate } = await import('@/lib/payment-due');
    let globalDueDays = 5;
    try {
      const { data: ps } = await adminClient.from('payment_settings').select('seat_lock_due_days_before').order('created_at', { ascending: false }).limit(1).single();
      if (ps?.seat_lock_due_days_before != null) globalDueDays = Number(ps.seat_lock_due_days_before);
    } catch { /* fall back to 5 */ }
    const dueDate = resolveDueDate(booking.trips?.start_date, (booking.trips as any)?.payment_due_days_before, globalDueDays);

    // Log the activity
    await adminClient
      .from('admin_activity_log')
      .insert({
        user_id: userId,
        admin_id: auth.user.id,
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

