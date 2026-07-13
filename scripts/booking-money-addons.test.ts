/**
 * Money-model tests: add-ons must flow through fullOwed / remaining correctly.
 *   npx tsx scripts/booking-money-addons.test.ts
 */
import assert from 'node:assert/strict';
import { fullOwed, paidOf, remainingOf, moneyOf } from '../lib/booking-money';

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log('Booking money × add-ons');

// TEST 1 — full pay: base ₹25,996 + Rohtang ₹2,000, paid ₹27,996 → nothing owed
check('full-pay base+addons paid in full → remaining 0', () => {
  const b = {
    number_of_participants: 4,
    total_price: 25996, final_amount: 25996, addons_total: 2000,
    payment_method: 'full', booking_status: 'confirmed',
    payment_transactions: [{ amount: 27996, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  assert.equal(fullOwed(b), 27996);
  assert.equal(paidOf(b), 27996);
  assert.equal(remainingOf(b), 0);
  assert.equal(moneyOf(b).status, 'paid');
});

// TEST 2 — seat-lock: full base owed + add-ons roll into remaining, only deposit paid
check('seat-lock: add-ons roll into remaining balance', () => {
  const b = {
    number_of_participants: 4,
    total_price: 4000, final_amount: 4000, addons_total: 2000,
    payment_method: 'seat_lock', booking_status: 'seat_locked',
    payment_transactions: [{ amount: 4000, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  assert.equal(fullOwed(b), 6499 * 4 + 2000);      // 27,996
  assert.equal(paidOf(b), 4000);
  assert.equal(remainingOf(b), 27996 - 4000);       // 23,996
  assert.equal(moneyOf(b).status, 'partial');
});

// TEST 3 — no add-ons: numbers identical to before the feature
check('no add-ons → unchanged', () => {
  const b = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 12998, addons_total: 0,
    payment_method: 'full',
    payment_transactions: [{ amount: 12998, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  assert.equal(fullOwed(b), 12998);
  assert.equal(remainingOf(b), 0);
});

// TEST 4 — add-on ADDED after full payment → outstanding balance appears (edge case 18)
check('add-on added after payment → outstanding balance', () => {
  const paidBooking = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 12998, addons_total: 0,
    payment_method: 'full',
    payment_transactions: [{ amount: 12998, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  const afterAddon = { ...paidBooking, addons_total: 1500 };
  assert.equal(fullOwed(afterAddon), 14498);
  assert.equal(remainingOf(afterAddon), 1500);
  assert.equal(moneyOf(afterAddon).status, 'partial');
});

// TEST 5 — waiver still applies on top of add-ons
check('waived amount reduces what is owed, add-ons included', () => {
  const b = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 12998, addons_total: 1000, waived_amount: 500,
    payment_method: 'full',
    payment_transactions: [{ amount: 13498, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  // fullPrice 13,998; owed = 13,998 − 500 = 13,498; paid 13,498 → remaining 0
  assert.equal(fullOwed(b), 13998);
  assert.equal(moneyOf(b).owed, 13498);
  assert.equal(remainingOf(b), 0);
});

console.log(`\nAll ${passed} booking-money × add-on checks passed.`);
