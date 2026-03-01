import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppService } from '@/lib/whatsapp';

export const runtime = "nodejs";

/**
 * Send WhatsApp notification for booking confirmation
 * POST /api/whatsapp/send-booking-notification
 * Body: { bookingId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Fetch booking details with user and trip info
    const adminClient = createAdminClient();
    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select(`
        *,
        profiles!bookings_user_id_fkey (
          phone,
          first_name,
          last_name
        ),
        trips (
          title,
          destination,
          start_date,
          end_date,
          whatsapp_group_link
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check if booking is confirmed
    if (booking.booking_status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Booking is not confirmed' },
        { status: 400 }
      );
    }

    // Get phone number - prefer booking phone, then profile phone
    const phoneNumber = booking.primary_passenger_phone || 
                       (booking.profiles as any)?.phone;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found for this booking' },
        { status: 400 }
      );
    }

    // Get user name
    const profile = booking.profiles as any;
    const userName = profile?.first_name 
      ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}`
      : booking.primary_passenger_name || 'Traveler';

    // Get trip details
    const trip = booking.trips as any;
    if (!trip) {
      return NextResponse.json(
        { error: 'Trip details not found' },
        { status: 404 }
      );
    }

    // Initialize WhatsApp service
    const whatsapp = getWhatsAppService();
    
    // Check if package is installed
    if (!whatsapp.isPackageInstalled()) {
      return NextResponse.json(
        { error: '@whiskeysockets/baileys is not installed. Please install it to enable WhatsApp notifications.' },
        { status: 503 }
      );
    }
    
    // Ensure client is ready
    if (!whatsapp.getReady()) {
      await whatsapp.initialize();
      await whatsapp.waitForReady();
    }

    // Send booking confirmation message
    await whatsapp.sendBookingConfirmation(phoneNumber, {
      bookingId: booking.id,
      userName: userName,
      tripTitle: trip.title,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      totalAmount: parseFloat(booking.final_amount || booking.amount_paid || 0),
      numberOfParticipants: booking.number_of_participants || 1,
      whatsappGroupLink: trip.whatsapp_group_link,
    });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp notification sent successfully',
    });
  } catch (error: any) {
    console.error('Error sending WhatsApp notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send WhatsApp notification' },
      { status: 500 }
    );
  }
}



