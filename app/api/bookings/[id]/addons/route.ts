import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-helpers';
import { validateAndPriceAddons, writeBookingAddons, passengerNameMap } from '@/lib/addons-server';

export const runtime = 'nodejs';

/**
 * Snapshot add-ons for a booking the caller owns. Used by the manual/QR payment
 * flow (which inserts the booking client-side and can't write booking_addons
 * under RLS). Re-prices authoritatively from the DB — the client total is ignored.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const selections = Array.isArray(body.selections) ? body.selections : [];

  const admin = createAdminClient();
  const { data: booking, error } = await admin
    .from('bookings')
    .select('id, user_id, trip_id, number_of_participants, passengers')
    .eq('id', params.id)
    .single();

  if (error || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.user_id !== auth.user.id) {
    return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
  }

  const { data: trip } = await admin
    .from('trips')
    .select('duration_days, addons_enabled')
    .eq('id', booking.trip_id)
    .single();

  if (!trip?.addons_enabled) return NextResponse.json({ success: true, addonsTotal: 0 });

  const paxCount = Number(booking.number_of_participants) || 1;
  const priced = await validateAndPriceAddons(admin, {
    tripId: booking.trip_id,
    tripDurationDays: Number(trip.duration_days) || 1,
    paxCount,
    selections,
    excludeBookingId: booking.id,
  });
  if (priced.error) return NextResponse.json({ error: priced.error }, { status: 400 });

  await writeBookingAddons(
    admin,
    booking.id,
    priced,
    { paxCount, tripDurationDays: Number(trip.duration_days) || 1 },
    passengerNameMap(booking.passengers as any[]),
  );

  return NextResponse.json({ success: true, addonsTotal: priced.addonsTotal });
}
