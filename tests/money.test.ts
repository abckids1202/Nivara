import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDeliveryFee,
  calculateOrderTotal,
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_DELIVERY_FEE_PAISE,
} from '../lib/money.ts';
import { canConvertReservation } from '../lib/payment-rules.ts';

void test('charges standard delivery below the free-shipping threshold', () => {
  assert.equal(
    calculateDeliveryFee(FREE_SHIPPING_THRESHOLD_PAISE - 1),
    STANDARD_DELIVERY_FEE_PAISE,
  );
  assert.equal(calculateOrderTotal(50_000), 57_900);
});

void test('waives delivery at the free-shipping threshold', () => {
  assert.equal(calculateDeliveryFee(FREE_SHIPPING_THRESHOLD_PAISE), 0);
  assert.equal(
    calculateOrderTotal(FREE_SHIPPING_THRESHOLD_PAISE),
    FREE_SHIPPING_THRESHOLD_PAISE,
  );
});

void test('rejects invalid money values', () => {
  assert.throws(() => calculateDeliveryFee(-1), /non-negative integer/);
  assert.throws(() => calculateDeliveryFee(10.5), /non-negative integer/);
});

void test('converts only active reservations with enough physical stock', () => {
  assert.equal(
    canConvertReservation({ status: 'ACTIVE', stockOnHand: 1, quantity: 1 }),
    true,
  );
  assert.equal(
    canConvertReservation({ status: 'ACTIVE', stockOnHand: 0, quantity: 1 }),
    false,
  );
  assert.equal(
    canConvertReservation({ status: 'EXPIRED', stockOnHand: 1, quantity: 1 }),
    false,
  );
  assert.equal(
    canConvertReservation({ status: 'RELEASED', stockOnHand: 5, quantity: 1 }),
    false,
  );
});
