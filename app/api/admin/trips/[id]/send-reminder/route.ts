import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const adminClient = createAdminClient();

    // Get trip details
    const { data: trip, error: tripError } = await adminClient
      .from('trips')
      .select('*')
      .eq('id', id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Get all bookings for this trip
    const { data: bookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select(`
        *,
        profiles:user_id (
          email,
          first_name,
          last_name
        )
      `)
      .eq('trip_id', id)
      .in('booking_status', ['confirmed', 'seat_locked']);

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      );
    }

    // Send reminder emails
    const emailPromises = bookings.map(async (booking: any) => {
      const user = booking.profiles;
      if (!user?.email) return;

      try {
        await sendEmail({
          to: user.email,
          subject: `Reminder: ${trip.title} - ${new Date(trip.start_date).toLocaleDateString()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Trip Reminder</h2>
              <p>Hi ${user.first_name || 'there'},</p>
              <p>This is a reminder about your upcoming trip:</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">${trip.title}</h3>
                <p><strong>Destination:</strong> ${trip.destination}</p>
                <p><strong>Start Date:</strong> ${new Date(trip.start_date).toLocaleDateString()}</p>
                ${trip.end_date ? `<p><strong>End Date:</strong> ${new Date(trip.end_date).toLocaleDateString()}</p>` : ''}
                <p><strong>Duration:</strong> ${trip.duration_days} days</p>
              </div>
              <p>Please make sure you're prepared for the trip!</p>
              <p>If you have any questions, please contact us.</p>
              <p>Best regards,<br>Ghumakkars Team</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error(`Error sending email to ${user.email}:`, emailError);
      }
    });

    await Promise.all(emailPromises);

    return NextResponse.json({
      success: true,
      message: `Reminders sent to ${bookings.length} users`,
    });
  } catch (error: any) {
    console.error('Error sending reminders:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

