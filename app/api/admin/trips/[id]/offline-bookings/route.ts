import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { revalidateTripById } from '@/lib/revalidate-trips';
import { isValidDeparture } from '@/lib/recurrence';
import { moneyOf } from '@/lib/booking-money';
import { validateAndPriceAddons, writeBookingAddons, markBookingAddonsPaid } from '@/lib/addons-server';

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
      package_price,
      amount_paid,
      payment_state = 'partial',
      booking_date,
      departure_date,
      pickup_point,
      primary_passenger_age,
      primary_passenger_gender,
      emergency_contact_name,
      emergency_contact_phone,
      passenger_details,
      passengers: passengersBody,
      addon_selections,
      notes,
    } = body;

    if (!name || !mobile) {
      return NextResponse.json(
        { error: 'Name and mobile number are required' },
        { status: 400 }
      );
    }

    const numParticipants = Math.max(1, parseInt(String(participants), 10) || 1);
    const amount = Math.max(0, parseFloat(String(amount_paid ?? 0)) || 0);

    const adminClient = createAdminClient();

    const { data: trip, error: tripError } = await adminClient
      .from('trips')
      .select('id, title, max_participants, current_participants, booking_disabled, discounted_price, seat_lock_price, is_recurring, recurrence_day, recurrence_weeks_ahead, duration_days, addons_enabled')
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

    const max = Number(trip.max_participants) || 0;
    let current = Number(trip.current_participants) || 0;
    let validatedDeparture: string | null = null;

    if (trip.is_recurring) {
      if (!departure_date) {
        return NextResponse.json({ error: 'Please choose a departure date for this trip.' }, { status: 400 });
      }
      const weekday = Number(trip.recurrence_day);
      const weeksAhead = Number(trip.recurrence_weeks_ahead) || 4;
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !isValidDeparture(String(departure_date), weekday, weeksAhead)) {
        return NextResponse.json({ error: 'That departure date is not available. Please pick one of the listed dates.' }, { status: 400 });
      }
      validatedDeparture = String(departure_date);
      if (max > 0) {
        const { data: batchBookings } = await adminClient
          .from('bookings')
          .select('number_of_participants')
          .eq('trip_id', tripId)
          .eq('departure_date', validatedDeparture)
          .in('booking_status', ['confirmed', 'seat_locked', 'pending']);
        current = (batchBookings || []).reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0);
      }
    }

    if (max > 0 && current + numParticipants > max) {
      return NextResponse.json({ error: `Only ${Math.max(0, max - current)} seat(s) left for this trip` }, { status: 400 });
    }

    const mobileClean = String(mobile).replace(/\D/g, '').slice(0, 20);
    const passengerRows = (() => {
      const rows = Array.isArray(passengersBody) && passengersBody.length > 0
        ? passengersBody
        : (passenger_details ? (typeof passenger_details === 'string' ? [{ name: passenger_details }] : passenger_details) : []);
      const cleaned = (rows || [])
        .map((p: { name?: string; age?: string; gender?: string; phone?: string; pid?: string; is_primary?: boolean }, index: number) => ({
          pid: p?.pid || (index === 0 ? 'primary' : `offline_${index}`),
          name: String(p?.name ?? '').trim() || undefined,
          age: p?.age != null ? String(p.age).trim() || undefined : undefined,
          gender: p?.gender ? String(p.gender).trim() : undefined,
          phone: p?.phone ? String(p.phone).replace(/\D/g, '').slice(0, 20) : undefined,
          is_primary: index === 0 ? true : !!p?.is_primary,
        }))
        .filter((p: { name?: string }) => p.name);
      if (cleaned.length > 0) return cleaned;
      return [{
        pid: 'primary',
        name: String(name).trim().slice(0, 255),
        age: primary_passenger_age != null ? String(primary_passenger_age).trim() : undefined,
        gender: primary_passenger_gender ? String(primary_passenger_gender).trim() : undefined,
        phone: mobileClean || undefined,
        is_primary: true,
      }];
    })();

    const publicBaseTotal = Math.max(0, (Number(trip.discounted_price) || 0) * numParticipants);
    const baseTotal = package_price != null
      ? Math.max(0, parseFloat(String(package_price)) || 0)
      : publicBaseTotal;

    if (baseTotal <= 0) {
      return NextResponse.json({ error: 'Package price is required for offline bookings.' }, { status: 400 });
    }

    let pricedAddons: Awaited<ReturnType<typeof validateAndPriceAddons>> | null = null;
    let addonsTotal = 0;
    if (trip.addons_enabled) {
      pricedAddons = await validateAndPriceAddons(adminClient, {
        tripId,
        tripDurationDays: Number(trip.duration_days) || 1,
        paxCount: numParticipants,
        selections: addon_selections,
      });
      if (pricedAddons.error) {
        return NextResponse.json({ error: pricedAddons.error }, { status: 400 });
      }
      addonsTotal = pricedAddons.addonsTotal;
    }

    const grandTotal = baseTotal + addonsTotal;
    const requestedState = String(payment_state || '').toLowerCase();
    const normalizedPaid = requestedState === 'paid' ? grandTotal : requestedState === 'unpaid' ? 0 : Math.min(amount, grandTotal);
    const paid = Math.max(0, Math.min(normalizedPaid, grandTotal));
    const bookingStatus = paid > 0 ? 'confirmed' : 'pending';
    const paymentStatus = paid >= grandTotal - 0.5 ? 'paid' : paid > 0 ? 'partial' : 'pending';

    const bookingPayload: Record<string, unknown> = {
      trip_id: tripId,
      user_id: null,
      number_of_participants: numParticipants,
      total_price: baseTotal,
      final_amount: baseTotal,
      departure_date: validatedDeparture,
      booking_status: bookingStatus,
      payment_method: 'full',
      payment_mode: 'cash',
      payment_status: paymentStatus,
      amount_paid: paid,
      addons_total: addonsTotal,
      primary_passenger_name: String(name).trim().slice(0, 255),
      primary_passenger_phone: mobileClean || null,
      primary_passenger_age: primary_passenger_age != null ? parseInt(String(primary_passenger_age), 10) || null : null,
      primary_passenger_gender: primary_passenger_gender || null,
      contact_phone: mobileClean || null,
      contact_email: null,
      emergency_contact_name: emergency_contact_name ? String(emergency_contact_name).trim().slice(0, 255) : null,
      emergency_contact_phone: emergency_contact_phone ? String(emergency_contact_phone).replace(/\D/g, '').slice(0, 20) : null,
      pickup_point: pickup_point ? String(pickup_point).trim().slice(0, 200) : null,
      is_offline_booking: true,
      passengers: passengerRows,
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

    if (pricedAddons && booking?.id) {
      await writeBookingAddons(
        adminClient,
        booking.id,
        pricedAddons,
        { paxCount: numParticipants, tripDurationDays: Number(trip.duration_days) || 1 },
        Object.fromEntries(passengerRows.map((p: any) => [p.pid, p.name || ''])),
      );
    }

    if (paid > 0 && booking?.id) {
      await adminClient.from('payment_transactions').insert([{
        booking_id: booking.id,
        user_id: null,
        transaction_id: `OFFLINE_CASH_${Date.now()}`,
        amount: paid,
        payment_type: 'offline',
        payment_status: 'verified',
        payment_mode: 'cash',
        payment_reviewed_at: new Date().toISOString(),
        payment_reviewed_by: auth.user.id,
        payment_review_notes: notes ? String(notes).slice(0, 500) : 'Offline booking recorded by admin',
        customer_name: String(name).trim().slice(0, 255),
        customer_phone: mobileClean || null,
        paid_at: new Date().toISOString(),
      }]);

      const money = moneyOf({ ...booking, addons_total: addonsTotal, payment_transactions: [{ amount: paid, payment_status: 'verified' }] }, trip);
      await adminClient.from('bookings').update({
        amount_paid: money.paid,
        payment_status: money.status,
        booking_status: 'confirmed',
      }).eq('id', booking.id);
      if (money.status === 'paid') {
        await markBookingAddonsPaid(adminClient, booking.id).catch(() => {});
      }
    }

    await adminClient
      .from('trips')
      .update({
        current_participants: ((Number(trip.current_participants) || 0) + numParticipants),
      })
      .eq('id', tripId);

    // Seat availability changed — refresh this trip's public pages immediately.
    await revalidateTripById(tripId);
    return NextResponse.json(booking);
  } catch (error: any) {
    console.error('Error in POST offline-bookings:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
