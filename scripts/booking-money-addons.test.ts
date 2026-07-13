/**
 * Money-model tests: add-ons must flow through fullOwed / remaining correctly.
 *   npx tsx scripts/booking-money-addons.test.ts
 */
import assert from 'node:assert/strict';
import { derivePaymentStatus, fullOwed, paidOf, payableNowOf, pendingCashOf, remainingOf, moneyOf } from '../lib/booking-money';

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok ${name}`);
};

console.log('Booking money x add-ons');

check('full-pay base+addons paid in full leaves remaining 0', () => {
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

check('regression: full-pay 12998 + 2000 records 14998 as paid', () => {
  const b = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 12998, addons_total: 2000,
    payment_method: 'full', booking_status: 'confirmed',
    payment_transactions: [{ amount: 14998, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  assert.equal(fullOwed(b), 14998);
  assert.equal(paidOf(b), 14998);
  assert.equal(remainingOf(b), 0);
  assert.equal(payableNowOf(b), 0);
  assert.equal(moneyOf(b).status, 'paid');
});

check('seat-lock: add-ons roll into remaining balance', () => {
  const b = {
    number_of_participants: 4,
    total_price: 4000, final_amount: 4000, addons_total: 2000,
    payment_method: 'seat_lock', booking_status: 'seat_locked',
    payment_transactions: [{ amount: 4000, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  assert.equal(fullOwed(b), 6499 * 4 + 2000);
  assert.equal(paidOf(b), 4000);
  assert.equal(remainingOf(b), 27996 - 4000);
  assert.equal(moneyOf(b).status, 'partial');
});

check('regression: seat-lock accepts 3000 now and leaves 11998', () => {
  const b = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 3000, addons_total: 2000,
    payment_method: 'seat_lock', booking_status: 'pending',
    payment_transactions: [],
    trips: { discounted_price: 6499 },
  };
  assert.equal(fullOwed(b), 14998);
  assert.equal(payableNowOf(b), 3000);

  const paid = {
    ...b,
    booking_status: 'seat_locked',
    payment_transactions: [{ amount: 3000, payment_status: 'verified' }],
  };
  assert.equal(paidOf(paid), 3000);
  assert.equal(remainingOf(paid), 11998);
  assert.equal(moneyOf(paid).status, 'partial');
});

check('pay-in-person seat-lock with add-ons shows due now, not paid', () => {
  const b = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 3000, addons_total: 2000,
    payment_method: 'seat_lock', payment_mode: 'cash', payment_status: 'cash_pending',
    booking_status: 'pending', amount_paid: 0,
    payment_transactions: [],
    trips: { discounted_price: 6499 },
  };
  const cash = pendingCashOf(b);
  assert.equal(cash.grandTotal, 14998);
  assert.equal(cash.amountPaid, 0);
  assert.equal(cash.dueNow, 3000);
  assert.equal(cash.remainingAfterDueNow, 11998);
  assert.equal(cash.totalOutstanding, 14998);
});

check('pay-in-person full with add-ons shows full grand total due now', () => {
  const b = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 12998, addons_total: 2000,
    payment_method: 'full', payment_mode: 'cash', payment_status: 'cash_pending',
    booking_status: 'pending', amount_paid: 0,
    payment_transactions: [],
    trips: { discounted_price: 6499 },
  };
  const cash = pendingCashOf(b);
  assert.equal(cash.grandTotal, 14998);
  assert.equal(cash.amountPaid, 0);
  assert.equal(cash.dueNow, 14998);
  assert.equal(cash.remainingAfterDueNow, 0);
  assert.equal(cash.totalOutstanding, 14998);
});

check('admin cash approval: 3000 seat-lock remains partial', () => {
  const b = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 3000, addons_total: 2000,
    payment_method: 'seat_lock', payment_mode: 'cash',
    payment_transactions: [{ amount: 3000, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  assert.equal(paidOf(b), 3000);
  assert.equal(remainingOf(b), 11998);
  assert.equal(derivePaymentStatus(paidOf(b), fullOwed(b), false), 'partial');
});

check('admin cash approval: 14998 full payment is paid', () => {
  const b = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 12998, addons_total: 2000,
    payment_method: 'full', payment_mode: 'cash',
    payment_transactions: [{ amount: 14998, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  assert.equal(paidOf(b), 14998);
  assert.equal(remainingOf(b), 0);
  assert.equal(derivePaymentStatus(paidOf(b), fullOwed(b), false), 'paid');
});

check('no add-ons remains unchanged', () => {
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

check('add-on added after payment creates outstanding balance', () => {
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

check('waived amount reduces what is owed, add-ons included', () => {
  const b = {
    number_of_participants: 2,
    total_price: 12998, final_amount: 12998, addons_total: 1000, waived_amount: 500,
    payment_method: 'full',
    payment_transactions: [{ amount: 13498, payment_status: 'verified' }],
    trips: { discounted_price: 6499 },
  };
  assert.equal(fullOwed(b), 13998);
  assert.equal(moneyOf(b).owed, 13498);
  assert.equal(remainingOf(b), 0);
});

console.log(`\nAll ${passed} booking-money x add-on checks passed.`);
