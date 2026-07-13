import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { revalidateTripById } from '@/lib/revalidate-trips';

export const runtime = 'nodejs';

const METHODS = ['per_booking', 'per_traveller', 'per_room', 'per_unit', 'per_traveller_night'];

/** List every add-on for a trip (admin sees inactive ones too). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('trip_addons')
    .select('*')
    .eq('trip_id', params.id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ addons: data || [] });
}

/**
 * Replace the trip's add-on set + toggle in one call. Existing rows are updated
 * by id, new rows inserted, and any row not present in the payload is deleted.
 * booking_addons snapshots are untouched (trip_addon_id is ON DELETE SET NULL),
 * so historical bookings keep their prices.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const tripId = params.id;
  const body = await req.json().catch(() => ({}));
  const enabled = !!body.enabled;
  const incoming: any[] = Array.isArray(body.addons) ? body.addons : [];

  const admin = createAdminClient();

  // Toggle first (independent of add-on rows).
  {
    const { error } = await admin.from('trips').update({ addons_enabled: enabled }).eq('id', tripId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clean = (a: any) => {
    const name = String(a?.name || '').trim();
    const method = METHODS.includes(a?.pricing_method) ? a.pricing_method : 'per_traveller';
    const intOrNull = (v: any) => (v == null || v === '' ? null : Math.trunc(Number(v)));
    return {
      trip_id: tripId,
      name,
      description: a?.description ? String(a.description) : null,
      icon_key: a?.icon_key ? String(a.icon_key).slice(0, 60) : null,
      category: a?.category ? String(a.category).slice(0, 40) : null,
      price: Math.max(0, Number(a?.price) || 0),
      pricing_method: method,
      room_occupancy: method === 'per_room' ? Math.max(1, Number(a?.room_occupancy) || 1) : null,
      exact_occupancy: method === 'per_room' ? !!a?.exact_occupancy : false,
      partial_occupancy: method === 'per_room' ? a?.partial_occupancy !== false : true,
      is_room_upgrade: method === 'per_room' ? true : !!a?.is_room_upgrade,
      chargeable_units: method === 'per_traveller_night' ? intOrNull(a?.chargeable_units) : null,
      min_quantity: Math.max(0, Math.trunc(Number(a?.min_quantity) || 1)),
      max_quantity: method === 'per_unit' ? intOrNull(a?.max_quantity) : null,
      capacity: intOrNull(a?.capacity),
      is_required: !!a?.is_required,
      is_refundable: a?.is_refundable !== false,
      is_active: a?.is_active !== false,
      display_order: Math.trunc(Number(a?.display_order) || 0),
    };
  };

  // Validate: every add-on needs a name.
  if (enabled) {
    const blank = incoming.find((a) => !String(a?.name || '').trim());
    if (blank) return NextResponse.json({ error: 'Every add-on needs a name.' }, { status: 400 });
  }

  const keepIds: string[] = [];
  try {
    for (const a of incoming) {
      const row = clean(a);
      const existingId = typeof a?.id === 'string' && !a.id.startsWith('new_') ? a.id : null;
      if (existingId) {
        const { error } = await admin.from('trip_addons').update(row).eq('id', existingId).eq('trip_id', tripId);
        if (error) throw error;
        keepIds.push(existingId);
      } else {
        const { data, error } = await admin.from('trip_addons').insert([row]).select('id').single();
        if (error) throw error;
        if (data?.id) keepIds.push(data.id);
      }
    }

    // Delete rows the admin removed.
    let del = admin.from('trip_addons').delete().eq('trip_id', tripId);
    if (keepIds.length > 0) del = del.not('id', 'in', `(${keepIds.join(',')})`);
    const { error: delErr } = await del;
    if (delErr) throw delErr;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save add-ons' }, { status: 500 });
  }

  await revalidateTripById(tripId);
  return NextResponse.json({ success: true, count: keepIds.length });
}
