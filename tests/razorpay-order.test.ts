import { describe, expect, it } from 'vitest';
import { readRazorpayOrderId } from '@/lib/razorpay-order';

describe('Razorpay order response validation', () => {
  it('accepts an order matching the server total', () => {
    expect(
      readRazorpayOrderId(
        { id: 'order_test_123', amount: 12_345, currency: 'INR' },
        12_345,
      ),
    ).toBe('order_test_123');
  });

  it('rejects missing, mismatched, or malformed provider data', () => {
    expect(readRazorpayOrderId({}, 12_345)).toBeNull();
    expect(
      readRazorpayOrderId(
        { id: 'order_test_123', amount: 12_346, currency: 'INR' },
        12_345,
      ),
    ).toBeNull();
    expect(
      readRazorpayOrderId(
        { id: 'order_test_123', amount: 12_345, currency: 'USD' },
        12_345,
      ),
    ).toBeNull();
    expect(
      readRazorpayOrderId(
        { id: '   ', amount: 12_345, currency: 'INR' },
        12_345,
      ),
    ).toBeNull();
  });
});
