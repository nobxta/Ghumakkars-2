import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-helpers';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      trip_id,
      number_of_participants,
      total_price,
      final_amount,
      coupon_code,
      coupon_discount,
      wallet_amount_used,
      primary_passenger_name,
      primary_passenger_email,
      primary_passenger_phone,
      primary_passenger_gender,
      primary_passenger_age,
      emergency_contact_name,
      emergency_contact_phone,
      college,
      passengers,
      payment_method,
      payment_mode,
      payment_status,
      booking_status,
      amount_paid,
      reference_id,
    } = body;

    if (!trip_id || !number_of_participants || number_of_participants < 1) {
      return NextResponse.json(
        { error: 'trip_id and number_of_participants (min 1) are required' },
        { status: 400 }
      );
    }

    if (total_price == null || final_amount == null) {
      return NextResponse.json(
        { error: 'total_price and final_amount are required' },
        { status: 400 }
      );
    }

    if (!primary_passenger_name || !primary_passenger_email || !primary_passenger_phone) {
      return NextResponse.json(
        { error: 'Primary passenger name, email and phone are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(passengers)) {
      return NextResponse.json(
        { error: 'passengers must be an array' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: trip, error: tripError } = await adminClient
      .from('trips')
      .select('id, max_participants, current_participants, is_active, booking_disabled')
      .eq('id', trip_id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    if (trip.booking_disabled) {
      return NextResponse.json(
        { error: 'Booking is currently disabled for this trip' },
        { status: 400 }
      );
    }

    const current = Number(trip.current_participants) || 0;
    const max = Number(trip.max_participants) || 0;
    const requested = Number(number_of_participants) || 1;
    if (max > 0 && current + requested > max) {
      return NextResponse.json(
        { error: `Not enough seats. Only ${max - current} seat(s) left.` },
        { status: 400 }
      );
    }

    const bookingPayload = {
      trip_id,
      user_id: auth.user.id,
      number_of_participants: requested,
      total_price: Number(total_price),
      final_amount: Number(final_amount),
      coupon_code: coupon_code || null,
      coupon_discount: Number(coupon_discount) || 0,
      wallet_amount_used: Number(wallet_amount_used) || 0,
      primary_passenger_name: String(primary_passenger_name).trim(),
      primary_passenger_email: String(primary_passenger_email).trim(),
      primary_passenger_phone: String(primary_passenger_phone).replace(/\D/g, ''),
      primary_passenger_gender: primary_passenger_gender || null,
      primary_passenger_age: primary_passenger_age != null ? parseInt(primary_passenger_age, 10) : null,
      emergency_contact_name: emergency_contact_name || null,
      emergency_contact_phone: emergency_contact_phone ? String(emergency_contact_phone).replace(/\D/g, '') : null,
      college: college && college !== 'Skip' ? college : null,
      passengers,
      payment_method: payment_method === 'seat_lock' ? 'seat_lock' : 'full',
      payment_mode: payment_mode || 'cash',
      payment_status: payment_status || 'pending',
      booking_status: booking_status || 'pending',
      amount_paid: Number(amount_paid) || 0,
      reference_id: reference_id || null,
    };

    const { data: booking, error: insertError } = await adminClient
      .from('bookings')
      .insert([bookingPayload])
      .select()
      .single();

    if (insertError) {
      console.error('Booking insert error:', insertError);
      return NextResponse.json(
        { error: insertError.message || 'Failed to create booking' },
        { status: 500 }
      );
    }

    if (coupon_code && booking?.id) {
      try {
        const { data: couponRow } = await adminClient
          .from('coupon_codes')
          .select('id')
          .eq('code', coupon_code.toUpperCase().trim())
          .single();

        if (couponRow) {
          await adminClient.from('coupon_usages').insert([
            {
              coupon_id: couponRow.id,
              booking_id: booking.id,
              user_id: auth.user.id,
              discount_amount: Number(coupon_discount) || 0,
            },
          ]);
          await adminClient.rpc('increment_coupon_usage', { coupon_id: couponRow.id });
        }
      } catch (e) {
        console.error('Coupon usage record error:', e);
      }
    }

    return NextResponse.json(booking);
  } catch (error: any) {
    console.error('Error in POST /api/bookings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}
