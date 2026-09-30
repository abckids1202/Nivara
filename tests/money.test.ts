import { describe, expect, it } from 'vitest';
import {
  calculateDeliveryFee,
  calculateOrderTotal,
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_DELIVERY_FEE_PAISE,
} from '../lib/money.ts';
import { canConvertReservation } from '../lib/payment-rules.ts';
import { checkoutRequestSchema } from '../lib/schemas.ts';

describe('money and reservation rules', () => {
  it('charges standard delivery below the free-shipping threshold', () => {
    expect(
    calculateDeliveryFee(FREE_SHIPPING_THRESHOLD_PAISE - 1),
    ).toBe(STANDARD_DELIVERY_FEE_PAISE);
    expect(calculateOrderTotal(50_000)).toBe(57_900);
  });

  it('waives delivery at the free-shipping threshold', () => {
    expect(calculateDeliveryFee(FREE_SHIPPING_THRESHOLD_PAISE)).toBe(0);
    expect(
    calculateOrderTotal(FREE_SHIPPING_THRESHOLD_PAISE),
    ).toBe(FREE_SHIPPING_THRESHOLD_PAISE);
  });

  it('rejects invalid money values', () => {
    expect(() => calculateDeliveryFee(-1)).toThrow(/non-negative integer/);
    expect(() => calculateDeliveryFee(10.5)).toThrow(/non-negative integer/);
  });

  it('converts only active reservations with enough physical stock', () => {
    expect(
    canConvertReservation({ status: 'ACTIVE', stockOnHand: 1, quantity: 1 }),
    ).toBe(true);
    expect(
    canConvertReservation({ status: 'ACTIVE', stockOnHand: 0, quantity: 1 }),
    ).toBe(false);
    expect(
    canConvertReservation({ status: 'EXPIRED', stockOnHand: 1, quantity: 1 }),
    ).toBe(false);
    expect(
    canConvertReservation({ status: 'RELEASED', stockOnHand: 5, quantity: 1 }),
    ).toBe(false);
  });

  it('rejects duplicate variants in a checkout request', () => {
    const result = checkoutRequestSchema.safeParse({
      email: 'shopper@example.com',
      fullName: 'Test Shopper',
      line1: '12 Market Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'IN',
      items: [
        { variantId: 'variant-1', quantity: 1 },
        { variantId: 'variant-1', quantity: 2 },
      ],
    });
    expect(result.success).toBe(false);
  });
});
