import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { revalidateTripById } from '@/lib/revalidate-trips';
import { computeAddon, validateSelection, type TripAddon, type PricingMethod } from '@/lib/addons';
import { passengerNameMap } from '@/lib/addons-server';

export const runtime = 'nodejs';

/** Recompute bookings.addons_total = sum of non-cancelled snapshot rows. */
async function recomputeTotal(admin: any, bookingId: string): Promise<number> {
  const { data } = await admin.from('booking_addons').select('addon_total, status').eq('booking_id', bookingId);
  const total = (data || [])
    .filter((r: any) => r.status !== 'cancelled')
    .reduce((s: number, r: any) => s + Number(r.addon_total || 0), 0);
  await admin.from('bookings').update({ addons_total: total }).eq('id', bookingId);
  return total;
}

async function logAudit(admin: any, adminId: string, userId: string | null, action: string, description: string, metadata: any) {
  try {
    await admin.from('admin_activity_log').insert([{
      user_id: userId || adminId,
      admin_id: adminId,
      action_type: `booking_addon_${action}`,
      action_description: description,
      metadata,
    }]);
  } catch (e) {
    console.error('audit log failed:', e);
  }
}

/** Build a TripAddon-shaped object from a stored snapshot row (for recompute). */
function addonFromSnapshot(row: any, priceOverride?: number): TripAddon {
  return {
    id: row.trip_addon_id || row.id,
    name: row.name,
    price: priceOverride != null ? priceOverride : Number(row.unit_price) || 0,
    pricing_method: row.pricing_method as PricingMethod,
    room_occupancy: row.room_occupancy,
    exact_occupancy: false, // manual admin edits use partial rounding
    chargeable_units: row.chargeable_units,
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const adminId = auth.user.id;
  const bookingId = params.id;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const admin = createAdminClient();

  const { data: booking } = await admin
    .from('bookings')
    .select('id, user_id, trip_id, number_of_participants, passengers')
    .eq('id', bookingId)
    .single();
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const { data: trip } = await admin.from('trips').select('duration_days').eq('id', booking.trip_id).single();
  const ctx = { paxCount: Number(booking.number_of_participants) || 1, tripDurationDays: Number(trip?.duration_days) || 1 };
  const names = passengerNameMap(booking.passengers as any[]);

  try {
    switch (action) {
      case 'add': {
        // Add a catalog add-on to this booking.
        const { data: cat } = await admin
          .from('trip_addons').select('*').eq('id', body.trip_addon_id).eq('trip_id', booking.trip_id).single();
        if (!cat) return NextResponse.json({ error: 'Add-on not found for this trip' }, { status: 404 });
        const selection = { addon_id: cat.id, passenger_ids: body.passenger_ids || [], quantity: body.quantity };
        const err = validateSelection(cat as TripAddon, selection, ctx);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
        const line = computeAddon(cat as TripAddon, selection, ctx);
        const selNames = line.passengerIds.map((pid) => names[pid] || '').filter(Boolean);
        await admin.from('booking_addons').insert([{
          booking_id: bookingId,
          trip_addon_id: cat.id,
          name: cat.name,
          description: cat.description ?? null,
          icon_key: cat.icon_key ?? null,
          category: cat.category ?? null,
          pricing_method: cat.pricing_method,
          unit_price: line.unitPrice,
          selected_passenger_ids: line.passengerIds,
          selected_passenger_names: selNames,
          quantity: line.quantity,
          room_occupancy: line.roomOccupancy,
          room_count: line.roomCount,
          chargeable_units: line.chargeableUnits,
          addon_total: line.total,
          is_refundable: cat.is_refundable !== false,
          status: 'selected',
          payment_status: 'pending',
        }]);
        await logAudit(admin, adminId, booking.user_id, 'add', `Added add-on "${cat.name}" (₹${line.total})`, { bookingId, addon: cat.name, total: line.total });
        break;
      }

      case 'update': {
        // Change passengers / quantity / price on an existing booking add-on.
        const { data: row } = await admin.from('booking_addons').select('*').eq('id', body.booking_addon_id).eq('booking_id', bookingId).single();
        if (!row) return NextResponse.json({ error: 'Add-on not found on this booking' }, { status: 404 });
        const priceOverride = body.unit_price != null ? Number(body.unit_price) : undefined;
        const addon = addonFromSnapshot(row, priceOverride);
        const selection = {
          addon_id: addon.id,
          passenger_ids: body.passenger_ids != null ? body.passenger_ids : (row.selected_passenger_ids || []),
          quantity: body.quantity != null ? body.quantity : row.quantity,
        };
        const err = validateSelection(addon, selection, ctx);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
        const line = computeAddon(addon, selection, ctx);
        const selNames = line.passengerIds.map((pid) => names[pid] || '').filter(Boolean);
        await admin.from('booking_addons').update({
          unit_price: line.unitPrice,
          selected_passenger_ids: line.passengerIds,
          selected_passenger_names: selNames,
          quantity: line.quantity,
          room_count: line.roomCount,
          chargeable_units: line.chargeableUnits,
          addon_total: line.total,
        }).eq('id', row.id);
        await logAudit(admin, adminId, booking.user_id, 'update', `Updated add-on "${row.name}" → ₹${line.total}`, { bookingId, addon: row.name, from: row.addon_total, to: line.total });
        break;
      }

      case 'remove': {
        const { data: row } = await admin.from('booking_addons').select('name, addon_total').eq('id', body.booking_addon_id).eq('booking_id', bookingId).single();
        await admin.from('booking_addons').delete().eq('id', body.booking_addon_id).eq('booking_id', bookingId);
        await logAudit(admin, adminId, booking.user_id, 'remove', `Removed add-on "${row?.name}" (₹${row?.addon_total})`, { bookingId, addon: row?.name });
        break;
      }

      case 'cancel': {
        const { data: row } = await admin.from('booking_addons').select('*').eq('id', body.booking_addon_id).eq('booking_id', bookingId).single();
        if (!row) return NextResponse.json({ error: 'Add-on not found' }, { status: 404 });
        const refundable = row.is_refundable !== false && row.payment_status === 'paid';
        await admin.from('booking_addons').update({
          status: 'cancelled',
          cancellation_reason: body.reason || null,
          cancelled_at: new Date().toISOString(),
          cancelled_by: adminId,
          refundable_amount: refundable ? Number(row.addon_total) || 0 : 0,
          payment_status: refundable ? 'refund_pending' : row.payment_status,
        }).eq('id', row.id);
        await logAudit(admin, adminId, booking.user_id, 'cancel', `Cancelled add-on "${row.name}"${refundable ? ` (refund ₹${row.addon_total} pending)` : ''}`, { bookingId, addon: row.name, reason: body.reason || null, refundable });
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const addonsTotal = await recomputeTotal(admin, bookingId);
    await revalidateTripById(booking.trip_id);
    return NextResponse.json({ success: true, addonsTotal });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Add-on action failed' }, { status: 500 });
  }
}
