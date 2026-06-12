import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

/** PATCH: update offline booking (amount, name, mobile, etc.) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const id = params.id;
    const body = await request.json();

    const adminClient = createAdminClient();
    const { data: existing, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, is_offline_booking')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.amount_paid != null) {
      const amt = parseFloat(String(body.amount_paid));
      if (!Number.isNaN(amt) && amt >= 0) {
        updates.amount_paid = amt;
        updates.final_amount = amt;
        updates.total_price = amt;
      }
    }
    if (body.primary_passenger_name != null) updates.primary_passenger_name = String(body.primary_passenger_name).trim().slice(0, 255);
    if (body.primary_passenger_phone != null) updates.primary_passenger_phone = String(body.primary_passenger_phone).replace(/\D/g, '').slice(0, 20);
    if (body.contact_phone != null) updates.contact_phone = String(body.contact_phone).replace(/\D/g, '').slice(0, 20);
    if (body.number_of_participants != null) {
      const n = Math.max(1, parseInt(String(body.number_of_participants), 10));
      if (!Number.isNaN(n)) updates.number_of_participants = n;
    }
    if (body.passengers != null) updates.passengers = body.passengers;
    // Move a booking to a different departure batch (or clear it).
    if (body.departure_date !== undefined) {
      const dep = body.departure_date;
      if (dep === null || dep === '') {
        updates.departure_date = null;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(dep))) {
        updates.departure_date = String(dep);
      } else {
        return NextResponse.json({ error: 'Invalid departure_date format' }, { status: 400 });
      }
    }
    if (body.pickup_point !== undefined) {
      updates.pickup_point = body.pickup_point ? String(body.pickup_point).slice(0, 200) : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updated, error } = await adminClient
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Booking update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error in PATCH booking:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: permanently remove a booking (spam / test data).
 * Cascades payment_transactions and decrements trip participant count
 * if the booking had been counted (confirmed / seat_locked).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const id = params.id;
    const adminClient = createAdminClient();

    const { data: booking, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, trip_id, number_of_participants, booking_status')
      .eq('id', id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Remove dependent payment records first (FK constraint)
    const { error: txErr } = await adminClient
      .from('payment_transactions')
      .delete()
      .eq('booking_id', id);
    if (txErr) {
      return NextResponse.json(
        { error: 'Failed to delete payment records: ' + txErr.message },
        { status: 500 }
      );
    }

    const { error: delErr } = await adminClient
      .from('bookings')
      .delete()
      .eq('id', id);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // If this booking was occupying seats, free them
    if (booking.trip_id && ['confirmed', 'seat_locked'].includes(booking.booking_status)) {
      const { data: trip } = await adminClient
        .from('trips')
        .select('current_participants')
        .eq('id', booking.trip_id)
        .single();
      if (trip) {
        await adminClient
          .from('trips')
          .update({
            current_participants: Math.max(
              0,
              (trip.current_participants || 0) - (booking.number_of_participants || 1)
            ),
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.trip_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting booking:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
