import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, requireAdmin, isInternalRequest } from '@/lib/auth-helpers';
import {
  sendBookingReceivedEmail,
  sendBookingConfirmedEmail,
  sendBookingRejectedEmail,
  sendSeatLockConfirmedEmail
} from '@/lib/email';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, status, rejectionReason, tripDetails, userEmail: bodyUserEmail, userName: bodyUserName } = body;

    if (!bookingId || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters: bookingId and status' },
        { status: 400 }
      );
    }

    // Access control: internal (webhook), admin, or owner of the booking
    const internal = isInternalRequest(request);
    if (!internal) {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;

      const adminAuth = await requireAdmin();
      const isAdmin = !(adminAuth instanceof NextResponse);

      const adminClient = createAdminClient();
      const { data: bookingForAuth, error: fetchAuthError } = await adminClient
        .from('bookings')
        .select('user_id, primary_passenger_email, primary_passenger_name')
        .eq('id', bookingId)
        .single();

      if (fetchAuthError || !bookingForAuth) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      if (!isAdmin && bookingForAuth.user_id !== auth.user.id) {
        return NextResponse.json(
          { error: 'You can only send notifications for your own booking' },
          { status: 403 }
        );
      }
    }

    // Resolve userEmail/userName from body or from booking
    let userEmail = bodyUserEmail;
    let userName = bodyUserName;

    // Use provided tripDetails or fetch booking details
    let trip: any;
    let booking: any;

    if (tripDetails) {
      // Use provided trip details
      trip = tripDetails;
      
      // Fetch booking for other details
      const adminClient = createAdminClient();
      const { data: bookingData } = await adminClient
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();
      booking = bookingData;
    } else {
      // Fetch booking details
      const adminClient = createAdminClient();
      const { data: bookingData, error: bookingError } = await adminClient
        .from('bookings')
        .select(`
          *,
          trips (
            title,
            destination,
            start_date,
            end_date,
            discounted_price,
            whatsapp_group_link
          )
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !bookingData) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }

      booking = bookingData;
      trip = booking.trips as any;
    }

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip details not found' },
        { status: 404 }
      );
    }

    userEmail = userEmail || booking?.primary_passenger_email;
    userName = userName || booking?.primary_passenger_name;
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing user email for notification' },
        { status: 400 }
      );
    }

    // Send appropriate email based on status
    switch (status) {
      case 'pending':
        await sendBookingReceivedEmail(
          userEmail,
          userName || booking.primary_passenger_name,
          {
            bookingId: booking.id,
            tripTitle: trip.title,
            destination: trip.destination,
          }
        );
        break;

      case 'seat_locked':
        // Calculate remaining amount and due date
        // Full trip price = discounted_price * number_of_participants
        // For seat lock, we need to fetch the trip's discounted_price if not already fetched
        let tripPrice = trip.discounted_price;
        if (!tripPrice && booking.trip_id) {
          const adminClientForTrip = createAdminClient();
          const { data: tripPriceData } = await adminClientForTrip
            .from('trips')
            .select('discounted_price')
            .eq('id', booking.trip_id)
            .single();
          tripPrice = tripPriceData?.discounted_price;
        }
        
        const fullTripPrice = (tripPrice || 0) * (booking.number_of_participants || 1);
        const paidAmount = parseFloat(booking.payment_amount) || parseFloat(booking.final_amount) || 0;
        const remainingAmount = Math.max(0, fullTripPrice - paidAmount);
        
        const startDate = new Date(trip.start_date);
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() - 5); // 5 days before departure

        await sendSeatLockConfirmedEmail(
          userEmail,
          userName || booking.primary_passenger_name,
          {
            bookingId: booking.id,
            tripTitle: trip.title,
            destination: trip.destination,
            startDate: trip.start_date,
            endDate: trip.end_date,
            seatLockAmount: paidAmount,
            remainingAmount: remainingAmount,
            dueDate: dueDate.toISOString().split('T')[0],
            whatsappGroupLink: trip.whatsapp_group_link,
          }
        );
        break;

      case 'confirmed':
        await sendBookingConfirmedEmail(
          userEmail,
          userName || booking.primary_passenger_name,
          {
            bookingId: booking.id,
            tripTitle: trip.title,
            destination: trip.destination,
            startDate: trip.start_date,
            endDate: trip.end_date,
            totalAmount: booking.payment_amount || booking.final_amount,
            whatsappGroupLink: trip.whatsapp_group_link,
          }
        );

        // Send WhatsApp notification
        try {
          const phoneNumber = booking.primary_passenger_phone || (booking as any).phone;
          if (phoneNumber) {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/whatsapp/send-booking-notification`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookingId: booking.id,
              }),
            });
          }
        } catch (whatsappError) {
          console.error('Error sending WhatsApp notification:', whatsappError);
          // Don't fail the whole process if WhatsApp fails
        }
        break;

      case 'rejected':
        await sendBookingRejectedEmail(
          userEmail,
          userName || booking.primary_passenger_name,
          {
            bookingId: booking.id,
            tripTitle: trip.title,
            destination: trip.destination,
            reason: rejectionReason || 'Payment verification failed',
          }
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification email sent successfully',
    });
  } catch (error: any) {
    console.error('Error sending booking notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}

