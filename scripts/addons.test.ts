/**
 * Pricing-engine tests for Trip Add-ons. No test framework — run with:
 *   npx tsx scripts/addons.test.ts
 * Exits non-zero on the first failed assertion.
 */
import assert from 'node:assert/strict';
import {
  computeAddon,
  computeSelections,
  validateSelection,
  validateRoomUpgradeConflicts,
  validateCapacity,
  withRequiredSelections,
  requiredRooms,
  calcLabelFromRow,
  sumBookingAddons,
  type TripAddon,
  type PricingContext,
} from '../lib/addons';

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const ctx = (pax: number, days = 3): PricingContext => ({ paxCount: pax, tripDurationDays: days });
const pax4 = ['p1', 'p2', 'p3', 'p4'];

const addon = (over: Partial<TripAddon>): TripAddon => ({
  id: over.id || 'a1',
  name: over.name || 'Add-on',
  price: over.price ?? 0,
  pricing_method: over.pricing_method || 'per_traveller',
  is_active: true,
  ...over,
});

console.log('Trip Add-ons pricing engine');

// TEST 1 — per selected traveller
check('T1 Rohtang Pass ₹1000 × 2 selected = ₹2000, only those 2 charged', () => {
  const a = addon({ name: 'Rohtang Pass', price: 1000, pricing_method: 'per_traveller' });
  const line = computeAddon(a, { addon_id: a.id, passenger_ids: ['p1', 'p3'] }, ctx(4));
  assert.equal(line.total, 2000);
  assert.deepEqual(line.passengerIds, ['p1', 'p3']);
  assert.equal(line.calcLabel, '₹1,000 × 2 travellers = ₹2,000');
});

// TEST 2 — per room, occupancy 2, two travellers = 1 room
check('T2 Double Sharing ₹2000/room occ2, 2 selected = 1 room ₹2000', () => {
  const a = addon({ name: 'Double Sharing', price: 2000, pricing_method: 'per_room', room_occupancy: 2, exact_occupancy: true, is_room_upgrade: true });
  const line = computeAddon(a, { addon_id: a.id, passenger_ids: ['p1', 'p2'] }, ctx(4));
  assert.equal(line.roomCount, 1);
  assert.equal(line.total, 2000);
  assert.equal(line.calcLabel, '₹2,000 × 1 room = ₹2,000');
});

// TEST 3 — per room, occupancy 3, six travellers = 2 rooms
check('T3 Triple Sharing ₹1500/room occ3, 6 selected = 2 rooms ₹3000', () => {
  const a = addon({ name: 'Triple Sharing', price: 1500, pricing_method: 'per_room', room_occupancy: 3, exact_occupancy: true, is_room_upgrade: true });
  const six = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  const line = computeAddon(a, { addon_id: a.id, passenger_ids: six }, ctx(6));
  assert.equal(line.roomCount, 2);
  assert.equal(line.total, 3000);
});

// TEST 4 — exact occupancy violation
check('T4 Triple Sharing occ3 exact, 4 selected → group-of-3 error', () => {
  const a = addon({ name: 'Triple Sharing', price: 1500, pricing_method: 'per_room', room_occupancy: 3, exact_occupancy: true });
  const err = validateSelection(a, { addon_id: a.id, passenger_ids: pax4 }, ctx(4));
  assert.ok(err && /groups of 3/.test(err), `expected group-of-3 error, got: ${err}`);
});

// per traveller per night
check('Meal ₹400 × 2 travellers × 3 nights = ₹2400', () => {
  const a = addon({ name: 'Meal Upgrade', price: 400, pricing_method: 'per_traveller_night', chargeable_units: 3 });
  const line = computeAddon(a, { addon_id: a.id, passenger_ids: ['p1', 'p2'] }, ctx(4));
  assert.equal(line.total, 2400);
  assert.equal(line.chargeableUnits, 3);
});

// per unit + max quantity
check('Extra Luggage ₹500 × 3 = ₹1500', () => {
  const a = addon({ name: 'Extra Luggage', price: 500, pricing_method: 'per_unit', min_quantity: 1, max_quantity: 5 });
  const line = computeAddon(a, { addon_id: a.id, quantity: 3 }, ctx(2));
  assert.equal(line.total, 1500);
});
check('per_unit quantity over max → error', () => {
  const a = addon({ price: 500, pricing_method: 'per_unit', max_quantity: 3 });
  const err = validateSelection(a, { addon_id: a.id, quantity: 4 }, ctx(2));
  assert.ok(err && /Maximum quantity/.test(err));
});

// flat per booking — pax-independent
check('Private Pickup ₹2500 per booking, pax-independent', () => {
  const a = addon({ name: 'Private Pickup', price: 2500, pricing_method: 'per_booking' });
  const l2 = computeAddon(a, { addon_id: a.id }, ctx(2));
  const l6 = computeAddon(a, { addon_id: a.id }, ctx(6));
  assert.equal(l2.total, 2500);
  assert.equal(l6.total, 2500);
});

// partial occupancy rounds up
check('partial occupancy occ3, 2 selected → 1 room', () => {
  assert.equal(requiredRooms(2, 3, false), 1);
  assert.equal(requiredRooms(4, 3, false), 2);
});

// incompatible room upgrades (same traveller in two upgrades)
check('T5 same traveller in Double + Triple → conflict error', () => {
  const dbl = addon({ id: 'd', name: 'Double', pricing_method: 'per_room', room_occupancy: 2, is_room_upgrade: true });
  const trp = addon({ id: 't', name: 'Triple', pricing_method: 'per_room', room_occupancy: 3, is_room_upgrade: true });
  const err = validateRoomUpgradeConflicts(
    [ { addon_id: 'd', passenger_ids: ['p1', 'p2'] }, { addon_id: 't', passenger_ids: ['p2', 'p3', 'p4'] } ],
    { d: dbl, t: trp },
  );
  assert.ok(err && /already assigned/.test(err));
});

// capacity
check('capacity: 2 left, request 3 → "Only 2 slots"', () => {
  const a = addon({ pricing_method: 'per_traveller', capacity: 12 });
  const err = validateCapacity(a, 3, 10); // used 10 of 12 → 2 left
  assert.ok(err && /Only 2 slots/.test(err));
});
check('capacity: none left → unavailable', () => {
  const a = addon({ pricing_method: 'per_traveller', capacity: 12 });
  const err = validateCapacity(a, 1, 12);
  assert.ok(err && /no longer available/.test(err));
});

// aggregate + required defaults
check('computeSelections sums two add-ons', () => {
  const rohtang = addon({ id: 'r', name: 'Rohtang', price: 1000, pricing_method: 'per_traveller' });
  const dbl = addon({ id: 'd', name: 'Double', price: 2000, pricing_method: 'per_room', room_occupancy: 2, is_room_upgrade: true });
  const res = computeSelections(
    [rohtang, dbl],
    [ { addon_id: 'r', passenger_ids: ['p1', 'p3'] }, { addon_id: 'd', passenger_ids: ['p1', 'p2'] } ],
    ctx(4),
  );
  assert.equal(res.total, 4000);
  assert.equal(res.errors.length, 0);
});

check('withRequiredSelections auto-selects all travellers for required add-on', () => {
  const req = addon({ id: 'x', is_required: true, pricing_method: 'per_traveller', price: 100 });
  const out = withRequiredSelections([req], [], pax4);
  const sel = out.find((s) => s.addon_id === 'x');
  assert.ok(sel);
  assert.deepEqual(sel!.passenger_ids, pax4);
});

// inactive add-on ignored in aggregate
check('inactive add-on is skipped in computeSelections', () => {
  const dead = addon({ id: 'z', is_active: false, price: 999, pricing_method: 'per_booking' });
  const res = computeSelections([dead], [{ addon_id: 'z' }], ctx(2));
  assert.equal(res.total, 0);
});

// snapshot-row label (used by detail views + PDFs) rebuilds from stored numbers
check('calcLabelFromRow rebuilds room calc from a snapshot', () => {
  const label = calcLabelFromRow({ pricing_method: 'per_room', unit_price: 2000, selected_passenger_ids: ['a', 'b'], room_count: 1, addon_total: 2000 });
  assert.equal(label, '₹2,000 × 1 room = ₹2,000');
});
check('calcLabelFromRow rebuilds per-night calc from a snapshot', () => {
  const label = calcLabelFromRow({ pricing_method: 'per_traveller_night', unit_price: 400, selected_passenger_ids: ['a', 'b'], chargeable_units: 3, addon_total: 2400 });
  assert.equal(label, '₹400 × 2 × 3 nights = ₹2,400');
});
check('sumBookingAddons excludes cancelled rows', () => {
  const rows = [
    { pricing_method: 'per_traveller', addon_total: 2000, status: 'selected' },
    { pricing_method: 'per_room', addon_total: 2000, status: 'cancelled' },
  ];
  assert.equal(sumBookingAddons(rows as any), 2000);
  assert.equal(sumBookingAddons(rows as any, true), 4000);
});
check('withRequiredSelections defaults per_unit required to min quantity', () => {
  const req = addon({ id: 'u', is_required: true, pricing_method: 'per_unit', price: 500, min_quantity: 2 });
  const out = withRequiredSelections([req], [], pax4);
  const sel = out.find((s) => s.addon_id === 'u');
  assert.equal(sel?.quantity, 2);
});

console.log(`\nAll ${passed} add-on engine checks passed.`);
