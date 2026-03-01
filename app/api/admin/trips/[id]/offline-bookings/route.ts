import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const tripId = params.id;
    const body = await request.json();
    const {
      name,
      mobile,
      participants = 1,
      amount_paid,
      booking_date,
      passenger_details,
      passengers: passengersBody,
    } = body;

    if (!name || !mobile) {
      return NextResponse.json(
        { error: 'Name and mobile number are required' },
        { status: 400 }
      );
    }

    const numParticipants = Math.max(1, parseInt(String(participants), 10) || 1);
    const amount = parseFloat(String(amount_paid ?? 0)) || 0;

    const adminClient = createAdminClient();

    const { data: trip, error: tripError } = await adminClient
      .from('trips')
      .select('id, max_participants, current_participants, booking_disabled')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    if (trip.booking_disabled) {
      return NextResponse.json(
        { error: 'Bookings are disabled for this trip' },
        { status: 400 }
      );
    }

    const current = Number(trip.current_participants) || 0;
    const max = Number(trip.max_participants) || 0;
    if (max > 0 && current + numParticipants > max) {
      return NextResponse.json(
        { error: `Only ${max - current} seat(s) left for this trip` },
        { status: 400 }
      );
    }

    const mobileClean = String(mobile).replace(/\D/g, '').slice(0, 20);
    const bookingPayload: Record<string, unknown> = {
      trip_id: tripId,
      user_id: null,
      number_of_participants: numParticipants,
      total_price: amount,
      final_amount: amount,
      booking_status: 'confirmed',
      payment_mode: 'cash',
      payment_status: 'paid',
      amount_paid: amount,
      primary_passenger_name: String(name).trim().slice(0, 255),
      primary_passenger_phone: mobileClean || null,
      contact_phone: mobileClean || null,
      contact_email: null,
      is_offline_booking: true,
      passengers: (() => {
        if (Array.isArray(passengersBody) && passengersBody.length > 0) {
          const list = passengersBody
            .map((p: { name?: string; age?: string }) => ({
              name: String(p?.name ?? '').trim() || undefined,
              age: p?.age != null ? String(p.age).trim() || undefined : undefined,
            }))
            .filter((p: { name?: string }) => p.name);
          return list.length > 0 ? list : null;
        }
        if (passenger_details) return typeof passenger_details === 'string' ? [{ name: passenger_details }] : passenger_details;
        return null;
      })(),
    };
    if (booking_date) bookingPayload.created_at = new Date(booking_date).toISOString();

    const { data: booking, error: insertError } = await adminClient
      .from('bookings')
      .insert([bookingPayload])
      .select()
      .single();

    if (insertError) {
      console.error('Offline booking insert error:', insertError);
      return NextResponse.json(
        { error: insertError.message || 'Failed to add offline booking' },
        { status: 500 }
      );
    }

    await adminClient
      .from('trips')
      .update({
        current_participants: (current + numParticipants),
      })
      .eq('id', tripId);

    return NextResponse.json(booking);
  } catch (error: any) {
    console.error('Error in POST offline-bookings:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
