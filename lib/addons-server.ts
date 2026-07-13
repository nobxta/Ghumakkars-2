/**
 * Server-side add-on validation + pricing. This is the ONLY place the backend
 * trusts for add-on money: it reloads the catalog from the DB, re-runs the same
 * pure engine the client used, and re-checks capacity across live bookings. The
 * client's claimed prices/quantities are never trusted.
 */
import {
  computeAddon,
  computeSelections,
  validateSelection,
  validateRoomUpgradeConflicts,
  unitsConsumed,
  validateCapacity,
  buildBookingAddonRows,
  type TripAddon,
  type AddonSelection,
} from './addons';

type AdminClient = any; // supabase service-role client

export async function loadActiveTripAddons(admin: AdminClient, tripId: string): Promise<TripAddon[]> {
  const { data } = await admin
    .from('trip_addons')
    .select('*')
    .eq('trip_id', tripId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []) as TripAddon[];
}

/** Units already consumed by an existing booking_addons snapshot row. */
function unitsOfRow(r: any): number {
  switch (r.pricing_method) {
    case 'per_booking': return 1;
    case 'per_room': return Number(r.room_count) || 0;
    case 'per_unit': return Number(r.quantity) || 0;
    case 'per_traveller':
    case 'per_traveller_night':
      return Array.isArray(r.selected_passenger_ids) ? r.selected_passenger_ids.length : 0;
    default: return 0;
  }
}

export interface PricedAddons {
  addons: TripAddon[];
  selections: AddonSelection[];
  addonsTotal: number;
  error?: string;
}

/**
 * Re-validate + re-price a set of add-on selections against current DB state,
 * including cross-booking capacity. Returns the authoritative total (or an error
 * to surface to the customer). Does NOT write anything.
 */
export async function validateAndPriceAddons(
  admin: AdminClient,
  opts: {
    tripId: string;
    tripDurationDays: number;
    paxCount: number;
    selections: AddonSelection[] | undefined;
    /** exclude this booking's own rows from capacity counting (edits) */
    excludeBookingId?: string;
  },
): Promise<PricedAddons> {
  const addons = await loadActiveTripAddons(admin, opts.tripId);
  const byId: Record<string, TripAddon> = {};
  for (const a of addons) byId[a.id] = a;
  const ctx = { paxCount: opts.paxCount, tripDurationDays: opts.tripDurationDays || 1 };

  // Only known, active add-ons. Drop unknown ids silently.
  const selections = (opts.selections || []).filter((s) => byId[s.addon_id]);

  // Per-selection rule validation.
  for (const s of selections) {
    const err = validateSelection(byId[s.addon_id], s, ctx);
    if (err) return { addons, selections, addonsTotal: 0, error: err };
  }

  // A traveller can't be in two room upgrades.
  const conflict = validateRoomUpgradeConflicts(selections, byId);
  if (conflict) return { addons, selections, addonsTotal: 0, error: conflict };

  // Cross-booking capacity.
  for (const s of selections) {
    const a = byId[s.addon_id];
    if (a.capacity == null) continue;
    const requested = unitsConsumed(computeAddon(a, s, ctx));
    let q = admin
      .from('booking_addons')
      .select('pricing_method, quantity, room_count, selected_passenger_ids, booking_id, status')
      .eq('trip_addon_id', a.id)
      .neq('status', 'cancelled');
    if (opts.excludeBookingId) q = q.neq('booking_id', opts.excludeBookingId);
    const { data: used } = await q;
    const usedUnits = (used || []).reduce((sum: number, r: any) => sum + unitsOfRow(r), 0);
    const err = validateCapacity(a, requested, usedUnits);
    if (err) return { addons, selections, addonsTotal: 0, error: err };
  }

  const { total } = computeSelections(addons, selections, ctx);
  return { addons, selections, addonsTotal: total };
}

/**
 * Snapshot the priced selections into booking_addons and set bookings.addons_total.
 * Replaces any existing snapshot rows for the booking (used on create + edit).
 */
export async function writeBookingAddons(
  admin: AdminClient,
  bookingId: string,
  priced: PricedAddons,
  ctx: { paxCount: number; tripDurationDays: number },
  passengerNameById: Record<string, string>,
): Promise<void> {
  await admin.from('booking_addons').delete().eq('booking_id', bookingId);
  const rows = buildBookingAddonRows(bookingId, priced.addons, priced.selections, ctx, passengerNameById);
  if (rows.length > 0) {
    await admin.from('booking_addons').insert(rows);
  }
  await admin.from('bookings').update({ addons_total: priced.addonsTotal }).eq('id', bookingId);
}

/** Map a booking's stored passengers array -> { pid: name } for snapshots. */
export function passengerNameMap(passengers: any[] | null | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of passengers || []) {
    if (p && p.pid) map[p.pid] = p.name || '';
  }
  return map;
}

/** Mark all of a booking's (non-cancelled) add-ons as paid — used when a booking is fully settled. */
export async function markBookingAddonsPaid(admin: AdminClient, bookingId: string): Promise<void> {
  await admin
    .from('booking_addons')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('booking_id', bookingId)
    .neq('status', 'cancelled');
}
