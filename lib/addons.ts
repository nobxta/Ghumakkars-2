/**
 * Trip Add-ons & Upgrades — the ONE authoritative pricing + validation engine.
 *
 * Pure, framework-free, no I/O. Imported by the customer booking UI, the
 * server-side price gate (`/api/bookings`), admin edits and PDF generation, so
 * add-on money is computed in exactly one place and can never drift between the
 * screen the customer sees and the amount the backend actually charges.
 *
 * Money rule (locked across the whole feature): `bookings.final_amount` is the
 * BASE amount collected at booking time and NEVER includes add-ons.
 * `bookings.addons_total` tracks add-ons separately, and the grand total a
 * customer owes = base owed + addons_total (see lib/booking-money.ts).
 */

export type PricingMethod =
  | 'per_booking'
  | 'per_traveller'
  | 'per_room'
  | 'per_unit'
  | 'per_traveller_night';

/** A row from `trip_addons` (admin-configured catalog). */
export interface TripAddon {
  id: string;
  trip_id?: string;
  name: string;
  description?: string | null;
  icon_key?: string | null;
  category?: string | null;
  price: number;
  pricing_method: PricingMethod;
  room_occupancy?: number | null;
  exact_occupancy?: boolean | null;
  partial_occupancy?: boolean | null;
  is_room_upgrade?: boolean | null;
  chargeable_units?: number | null;
  min_quantity?: number | null;
  max_quantity?: number | null;
  capacity?: number | null;
  is_required?: boolean | null;
  is_refundable?: boolean | null;
  is_active?: boolean | null;
  display_order?: number | null;
}

/** What a customer picked for a single add-on. */
export interface AddonSelection {
  addon_id: string;
  /** Passenger `pid`s (per_traveller / per_room / per_traveller_night). */
  passenger_ids?: string[];
  /** Units chosen (per_unit only). */
  quantity?: number;
}

export interface PassengerRef {
  pid: string;
  name: string;
}

export interface PricingContext {
  /** Total travellers in the booking. */
  paxCount: number;
  /** Trip length in days (`trips.duration_days`). */
  tripDurationDays: number;
}

export interface ComputedAddon {
  addon: TripAddon;
  passengerIds: string[];
  quantity: number;
  roomOccupancy: number | null;
  roomCount: number | null;
  chargeableUnits: number | null;
  unitPrice: number;
  total: number;
  /** e.g. "₹1,000 per traveller" */
  priceRuleLabel: string;
  /** e.g. "₹1,000 × 2 travellers = ₹2,000" */
  calcLabel: string;
}

// ─────────────────────────────── helpers ───────────────────────────────────

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** Round to whole rupees — add-on prices are always whole-rupee amounts. */
export const roundMoney = (n: number): number => Math.round(n);

/** ₹ with Indian digit grouping and no trailing .00. */
export function formatINR(n: number | string | null | undefined): string {
  const rounded = Math.round(num(n) * 100) / 100;
  const s = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `₹${s}`;
}

export const PRICING_METHOD_LABELS: Record<PricingMethod, string> = {
  per_booking: 'Flat price per booking',
  per_traveller: 'Per selected traveller',
  per_room: 'Per room',
  per_unit: 'Per unit',
  per_traveller_night: 'Per traveller per night',
};

/** Methods where the customer picks specific passengers. */
export function usesPassengerSelection(method: PricingMethod): boolean {
  return method === 'per_traveller' || method === 'per_room' || method === 'per_traveller_night';
}

/** Methods where the customer picks a quantity. */
export function usesQuantity(method: PricingMethod): boolean {
  return method === 'per_unit';
}

/** Nights in a trip (a 3-day trip has 2 nights); always at least 1. */
export function tripNights(tripDurationDays: number): number {
  return Math.max(1, (Number(tripDurationDays) || 1) - 1);
}

/** Chargeable units for a per-night add-on: admin override, else trip nights. */
export function chargeableUnitsFor(addon: TripAddon, ctx: PricingContext): number {
  if (addon.chargeable_units != null && Number(addon.chargeable_units) >= 0) {
    return Number(addon.chargeable_units);
  }
  return tripNights(ctx.tripDurationDays);
}

/** Rooms needed for `selected` travellers at a given occupancy. */
export function requiredRooms(
  selected: number,
  occupancy: number,
  exact: boolean,
): number {
  const occ = Math.max(1, Number(occupancy) || 1);
  if (selected <= 0) return 0;
  // Exact occupancy is validated separately; ceil keeps a sane number either way.
  if (exact) return Math.round(selected / occ);
  return Math.ceil(selected / occ);
}

// ────────────────────────────── price labels ───────────────────────────────

export function priceRuleLabel(addon: TripAddon): string {
  const p = formatINR(addon.price);
  switch (addon.pricing_method) {
    case 'per_booking': return `${p} per booking`;
    case 'per_traveller': return `${p} per traveller`;
    case 'per_room': return `${p} per room`;
    case 'per_unit': return `${p} per unit`;
    case 'per_traveller_night': return `${p} per traveller / night`;
    default: return p;
  }
}

/**
 * Calculation label rebuilt from a stored `booking_addons` snapshot row (which
 * already holds the computed numbers). Used by booking detail views + PDFs so we
 * never recompute historical prices.
 */
export interface BookingAddonRow {
  pricing_method: PricingMethod | string;
  unit_price?: number | string | null;
  selected_passenger_ids?: unknown;
  selected_passenger_names?: unknown;
  quantity?: number | null;
  room_count?: number | null;
  chargeable_units?: number | null;
  addon_total?: number | string | null;
}

export function calcLabelFromRow(r: BookingAddonRow): string {
  const ids = Array.isArray(r.selected_passenger_ids) ? r.selected_passenger_ids : [];
  const names = Array.isArray(r.selected_passenger_names) ? r.selected_passenger_names : [];
  const n = ids.length || names.length;
  const price = num(r.unit_price);
  const total = num(r.addon_total);
  switch (r.pricing_method) {
    case 'per_booking': return `${formatINR(price)} per booking`;
    case 'per_traveller': return `${formatINR(price)} × ${n} traveller${n === 1 ? '' : 's'} = ${formatINR(total)}`;
    case 'per_room': return `${formatINR(price)} × ${r.room_count ?? 0} room${(r.room_count ?? 0) === 1 ? '' : 's'} = ${formatINR(total)}`;
    case 'per_unit': return `${formatINR(price)} × ${r.quantity ?? 0} = ${formatINR(total)}`;
    case 'per_traveller_night': return `${formatINR(price)} × ${n} × ${r.chargeable_units ?? 0} night${(r.chargeable_units ?? 0) === 1 ? '' : 's'} = ${formatINR(total)}`;
    default: return formatINR(total);
  }
}

/** Sum of add-on totals for a set of snapshot rows (excludes cancelled by default). */
export function sumBookingAddons(rows: Array<BookingAddonRow & { status?: string }>, includeCancelled = false): number {
  return (rows || [])
    .filter((r) => includeCancelled || r.status !== 'cancelled')
    .reduce((s, r) => s + num(r.addon_total), 0);
}

// ─────────────────────────────── computation ───────────────────────────────

/**
 * Compute one add-on line. Pure math — assumes the selection already passed
 * validateSelection (callers that need safety should validate first). Unknown /
 * empty selections yield a ₹0 line rather than throwing.
 */
export function computeAddon(
  addon: TripAddon,
  selection: AddonSelection | undefined,
  ctx: PricingContext,
): ComputedAddon {
  const price = num(addon.price);
  const passengerIds = Array.isArray(selection?.passenger_ids) ? selection!.passenger_ids! : [];
  const n = passengerIds.length;
  let quantity = 1;
  let roomOccupancy: number | null = null;
  let roomCount: number | null = null;
  let chargeableUnits: number | null = null;
  let total = 0;
  let calc = '';

  switch (addon.pricing_method) {
    case 'per_booking':
      total = price;
      calc = `${formatINR(price)} per booking`;
      break;

    case 'per_traveller':
      total = price * n;
      calc = `${formatINR(price)} × ${n} traveller${n === 1 ? '' : 's'} = ${formatINR(total)}`;
      break;

    case 'per_room': {
      roomOccupancy = Math.max(1, Number(addon.room_occupancy) || 1);
      roomCount = requiredRooms(n, roomOccupancy, !!addon.exact_occupancy);
      total = price * roomCount;
      calc = `${formatINR(price)} × ${roomCount} room${roomCount === 1 ? '' : 's'} = ${formatINR(total)}`;
      break;
    }

    case 'per_unit':
      quantity = Math.max(0, Math.floor(num(selection?.quantity) || 0));
      total = price * quantity;
      calc = `${formatINR(price)} × ${quantity} = ${formatINR(total)}`;
      break;

    case 'per_traveller_night':
      chargeableUnits = chargeableUnitsFor(addon, ctx);
      total = price * n * chargeableUnits;
      calc = `${formatINR(price)} × ${n} traveller${n === 1 ? '' : 's'} × ${chargeableUnits} night${chargeableUnits === 1 ? '' : 's'} = ${formatINR(total)}`;
      break;

    default:
      total = 0;
  }

  return {
    addon,
    passengerIds,
    quantity,
    roomOccupancy,
    roomCount,
    chargeableUnits,
    unitPrice: price,
    total: roundMoney(total),
    priceRuleLabel: priceRuleLabel(addon),
    calcLabel: calc,
  };
}

// ─────────────────────────────── validation ────────────────────────────────

/**
 * Validate a single selection against its add-on's rules. Returns a
 * human-readable error, or null if valid. Capacity (cross-booking) is validated
 * separately by the server via validateCapacity().
 */
export function validateSelection(
  addon: TripAddon,
  selection: AddonSelection | undefined,
  _ctx: PricingContext,
): string | null {
  const passengerIds = Array.isArray(selection?.passenger_ids) ? selection!.passenger_ids! : [];
  const n = passengerIds.length;

  if (usesPassengerSelection(addon.pricing_method)) {
    if (n < 1) return 'Select at least one traveller for this add-on.';
  }

  if (addon.pricing_method === 'per_room') {
    const occ = Math.max(1, Number(addon.room_occupancy) || 1);
    if (addon.exact_occupancy && n % occ !== 0) {
      return `${addon.name} requires travellers to be selected in groups of ${occ}.`;
    }
  }

  if (addon.pricing_method === 'per_unit') {
    const q = Math.floor(num(selection?.quantity) || 0);
    const min = Math.max(0, Number(addon.min_quantity) || 0);
    if (q < Math.max(1, min)) {
      return min > 1 ? `Minimum quantity is ${min}.` : 'Choose a quantity for this add-on.';
    }
    if (addon.max_quantity != null && q > Number(addon.max_quantity)) {
      return `Maximum quantity allowed is ${addon.max_quantity}.`;
    }
  }

  return null;
}

/**
 * No traveller may be assigned to two room upgrades at once (Double + Triple,
 * etc.). Returns an error string or null.
 */
export function validateRoomUpgradeConflicts(
  selections: AddonSelection[],
  addonsById: Record<string, TripAddon>,
): string | null {
  const seen = new Map<string, string>(); // pid -> addon name
  for (const sel of selections) {
    const addon = addonsById[sel.addon_id];
    if (!addon || !addon.is_room_upgrade) continue;
    for (const pid of sel.passenger_ids || []) {
      if (seen.has(pid)) {
        return 'This traveller is already assigned to another room upgrade.';
      }
      seen.set(pid, addon.name);
    }
  }
  return null;
}

/**
 * Cross-booking availability. `used` = units already taken by other live
 * bookings, `requested` = units this booking wants. Returns an error or null.
 * The "unit" matches the pricing method (travellers / rooms / units / bookings).
 */
export function unitsConsumed(computed: ComputedAddon): number {
  switch (computed.addon.pricing_method) {
    case 'per_booking': return 1;
    case 'per_traveller':
    case 'per_traveller_night': return computed.passengerIds.length;
    case 'per_room': return computed.roomCount || 0;
    case 'per_unit': return computed.quantity;
    default: return 0;
  }
}

export function validateCapacity(
  addon: TripAddon,
  requested: number,
  used: number,
): string | null {
  if (addon.capacity == null) return null;
  const cap = Number(addon.capacity);
  const remaining = Math.max(0, cap - used);
  if (requested > remaining) {
    if (remaining <= 0) return 'This add-on is no longer available.';
    return `Only ${remaining} slot${remaining === 1 ? '' : 's'} ${remaining === 1 ? 'is' : 'are'} currently available.`;
  }
  return null;
}

// ─────────────────────────── booking assembly ──────────────────────────────

export interface AddonComputeResult {
  total: number;
  lines: ComputedAddon[];
  errors: string[];
}

/**
 * Compute the authoritative add-on total + per-line breakdown for a set of
 * selections. Skips inactive / unknown add-ons. Collects (does not throw)
 * validation errors so the caller can surface them.
 */
export function computeSelections(
  addons: TripAddon[],
  selections: AddonSelection[],
  ctx: PricingContext,
): AddonComputeResult {
  const byId: Record<string, TripAddon> = {};
  for (const a of addons) byId[a.id] = a;

  const lines: ComputedAddon[] = [];
  const errors: string[] = [];
  let total = 0;

  for (const sel of selections) {
    const addon = byId[sel.addon_id];
    if (!addon || addon.is_active === false) continue;
    const err = validateSelection(addon, sel, ctx);
    if (err) errors.push(err);
    const line = computeAddon(addon, sel, ctx);
    lines.push(line);
    total += line.total;
  }

  const conflict = validateRoomUpgradeConflicts(selections, byId);
  if (conflict) errors.push(conflict);

  return { total: roundMoney(total), lines, errors };
}

/**
 * Build the `booking_addons` snapshot rows for a booking. `passengerNameById`
 * maps a passenger `pid` to their name at booking time (names are snapshotted so
 * later profile edits never rewrite history).
 */
export function buildBookingAddonRows(
  bookingId: string,
  addons: TripAddon[],
  selections: AddonSelection[],
  ctx: PricingContext,
  passengerNameById: Record<string, string>,
): Array<Record<string, unknown>> {
  const byId: Record<string, TripAddon> = {};
  for (const a of addons) byId[a.id] = a;

  const rows: Array<Record<string, unknown>> = [];
  for (const sel of selections) {
    const addon = byId[sel.addon_id];
    if (!addon || addon.is_active === false) continue;
    const line = computeAddon(addon, sel, ctx);
    const names = line.passengerIds.map((pid) => passengerNameById[pid] || '').filter(Boolean);
    rows.push({
      booking_id: bookingId,
      trip_addon_id: addon.id,
      name: addon.name,
      description: addon.description ?? null,
      icon_key: addon.icon_key ?? null,
      category: addon.category ?? null,
      pricing_method: addon.pricing_method,
      unit_price: line.unitPrice,
      selected_passenger_ids: line.passengerIds,
      selected_passenger_names: names,
      quantity: line.quantity,
      room_occupancy: line.roomOccupancy,
      room_count: line.roomCount,
      chargeable_units: line.chargeableUnits,
      addon_total: line.total,
      is_refundable: addon.is_refundable !== false,
      status: 'selected',
      payment_status: 'pending',
    });
  }
  return rows;
}

/**
 * Ensure every REQUIRED active add-on has a selection. Required participant-based
 * add-ons default to ALL travellers; per_unit defaults to its minimum quantity.
 * The customer can't remove these in the UI.
 */
export function withRequiredSelections(
  addons: TripAddon[],
  selections: AddonSelection[],
  allPassengerIds: string[],
): AddonSelection[] {
  const bySel = new Map(selections.map((s) => [s.addon_id, s]));
  for (const a of addons) {
    if (a.is_active === false || !a.is_required) continue;
    if (bySel.has(a.id)) continue;
    if (usesPassengerSelection(a.pricing_method)) {
      bySel.set(a.id, { addon_id: a.id, passenger_ids: [...allPassengerIds] });
    } else if (usesQuantity(a.pricing_method)) {
      bySel.set(a.id, { addon_id: a.id, quantity: Math.max(1, Number(a.min_quantity) || 1) });
    } else {
      bySel.set(a.id, { addon_id: a.id });
    }
  }
  return Array.from(bySel.values());
}
