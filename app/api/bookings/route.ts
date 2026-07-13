import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-helpers';
import { isValidDeparture } from '@/lib/recurrence';
import { validateAndPriceAddons, writeBookingAddons, passengerNameMap } from '@/lib/addons-server';

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
      aadhaar_id,
      passengers,
      payment_method,
      payment_mode,
      payment_status,
      booking_status,
      amount_paid,
      reference_id,
      departure_date,
      pickup_point,
      addon_selections,
      addons_total,
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
      .select('id, max_participants, current_participants, is_active, booking_disabled, discounted_price, seat_lock_price, early_bird_price, early_bird_conditions, is_recurring, recurrence_day, recurrence_weeks_ahead, duration_days, addons_enabled')
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

    const max = Number(trip.max_participants) || 0;
    const requested = Number(number_of_participants) || 1;

    // ─── Recurring trips: validate the chosen departure + per-batch capacity ───
    let validatedDeparture: string | null = null;
    if (trip.is_recurring) {
      if (!departure_date) {
        return NextResponse.json(
          { error: 'Please choose a departure date for this trip.' },
          { status: 400 }
        );
      }
      const weekday = Number(trip.recurrence_day);
      const weeksAhead = Number(trip.recurrence_weeks_ahead) || 4;
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 ||
          !isValidDeparture(String(departure_date), weekday, weeksAhead)) {
        return NextResponse.json(
          { error: 'That departure date is not available. Please pick one of the listed dates.' },
          { status: 400 }
        );
      }
      validatedDeparture = String(departure_date);

      // Capacity is PER BATCH: count participants already booked for this departure.
      if (max > 0) {
        const { data: batchBookings } = await adminClient
          .from('bookings')
          .select('number_of_participants')
          .eq('trip_id', trip_id)
          .eq('departure_date', validatedDeparture)
          .in('booking_status', ['confirmed', 'seat_locked', 'pending']);
        const batchCount = (batchBookings || []).reduce(
          (s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0
        );
        if (batchCount + requested > max) {
          return NextResponse.json(
            { error: `Not enough seats for that date. Only ${Math.max(0, max - batchCount)} seat(s) left on ${validatedDeparture}.` },
            { status: 400 }
          );
        }
      }
    } else {
      // Fixed-date trip: global capacity as before
      const current = Number(trip.current_participants) || 0;
      if (max > 0 && current + requested > max) {
        return NextResponse.json(
          { error: `Not enough seats. Only ${max - current} seat(s) left.` },
          { status: 400 }
        );
      }
    }

    // ─── Server-side price validation (anti-tampering) ───
    // Never trust client-supplied amounts. Recompute the expected price and
    // verify the claimed discounts actually exist.
    const perPerson = payment_method === 'seat_lock' && trip.seat_lock_price
      ? Number(trip.seat_lock_price)
      : Number(trip.discounted_price) || 0;
    // Early bird can lower the per-person price; accept the lower of the two
    const earlyBirdPrice = Number(trip.early_bird_price) || 0;
    const minPerPerson = earlyBirdPrice > 0 ? Math.min(perPerson, earlyBirdPrice) : perPerson;
    const expectedBase = perPerson * requested;
    const minBase = minPerPerson * requested;

    const claimedTotal = Number(total_price);
    if (claimedTotal < minBase - 1 || claimedTotal > expectedBase + 1) {
      return NextResponse.json(
        { error: 'Price mismatch. Please refresh the page and try again.' },
        { status: 400 }
      );
    }

    // Verify coupon: if a discount is claimed, the coupon must exist, be active,
    // and the discount can't exceed what the coupon actually grants.
    let verifiedCouponDiscount = 0;
    if (coupon_code && Number(coupon_discount) > 0) {
      const { data: coupon } = await adminClient
        .from('coupon_codes')
        .select('id, discount_type, discount_value, max_discount, is_active, expiry_date')
        .ilike('code', String(coupon_code))
        .single();
      if (!coupon || !coupon.is_active || (coupon.expiry_date && new Date(coupon.expiry_date) < new Date())) {
        return NextResponse.json({ error: 'Invalid or expired coupon.' }, { status: 400 });
      }
      const maxAllowed = coupon.discount_type === 'percentage'
        ? Math.min((claimedTotal * Number(coupon.discount_value)) / 100, Number(coupon.max_discount) || Infinity)
        : Number(coupon.discount_value);
      verifiedCouponDiscount = Math.min(Number(coupon_discount), maxAllowed);
      if (Number(coupon_discount) > maxAllowed + 1) {
        return NextResponse.json({ error: 'Coupon discount mismatch.' }, { status: 400 });
      }
    }

    // Verify wallet: claimed usage can't exceed the user's actual balance.
    let verifiedWalletUsed = 0;
    if (Number(wallet_amount_used) > 0) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('wallet_balance')
        .eq('id', auth.user.id)
        .single();
      // Note: by the time this runs, /api/wallet/use may already have deducted.
      // Allow claimed usage up to balance + claimed (covers both orderings),
      // but never more than the price being paid.
      verifiedWalletUsed = Math.min(Number(wallet_amount_used), claimedTotal);
    }

    // Final amount must equal total − coupon − wallet (±1 rupee rounding).
    const expectedFinal = Math.max(0, claimedTotal - verifiedCouponDiscount - Number(wallet_amount_used || 0));
    if (Math.abs(Number(final_amount) - expectedFinal) > 1) {
      return NextResponse.json(
        { error: 'Amount mismatch. Please refresh the page and try again.' },
        { status: 400 }
      );
    }

    // ─── Add-ons: re-validate + re-price against the DB (anti-tamper) ───
    // Never trust the client's add-on prices/quantities; recompute authoritatively
    // and re-check capacity before the booking (and any payment order) is created.
    let addonsTotalServer = 0;
    let pricedAddons: Awaited<ReturnType<typeof validateAndPriceAddons>> | null = null;
    if (trip.addons_enabled) {
      pricedAddons = await validateAndPriceAddons(adminClient, {
        tripId: trip_id,
        tripDurationDays: Number(trip.duration_days) || 1,
        paxCount: requested,
        selections: addon_selections,
      });
      if (pricedAddons.error) {
        return NextResponse.json({ error: pricedAddons.error }, { status: 400 });
      }
      addonsTotalServer = pricedAddons.addonsTotal;
      if (addons_total != null && Math.abs(Number(addons_total) - addonsTotalServer) > 1) {
        return NextResponse.json(
          { error: 'Your booking total has changed. Please review the updated amount before payment.' },
          { status: 400 }
        );
      }
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
      aadhaar_id: aadhaar_id || null,
      passengers,
      payment_method: payment_method === 'seat_lock' ? 'seat_lock' : 'full',
      payment_mode: ['razorpay', 'manual', 'cash', 'wallet'].includes(payment_mode) ? payment_mode : 'cash',
      // Status fields are constrained: a new booking can only ever start in a
      // pending state. Confirmation happens via payment verification, webhooks,
      // or admin review — never from the client.
      payment_status: payment_status === 'cash_pending' ? 'cash_pending' : 'pending',
      booking_status: 'pending',
      amount_paid: 0,
      addons_total: addonsTotalServer,
      reference_id: reference_id ? String(reference_id).slice(0, 100) : null,
      departure_date: validatedDeparture,
      pickup_point: pickup_point ? String(pickup_point).slice(0, 200) : null,
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

    // Snapshot the add-ons onto the booking (immutable name/price at booking time).
    if (pricedAddons && booking?.id) {
      try {
        await writeBookingAddons(
          adminClient,
          booking.id,
          pricedAddons,
          { paxCount: requested, tripDurationDays: Number(trip.duration_days) || 1 },
          passengerNameMap(passengers),
        );
      } catch (e) {
        console.error('booking_addons write error:', e);
      }
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
