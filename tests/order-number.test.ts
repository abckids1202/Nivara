import { describe, expect, it } from 'vitest';
import { createOrderNumber } from '../lib/order-number.ts';

describe('order numbers', () => {
  it('has a readable prefix, timestamp, and high-entropy suffix', () => {
    const value = createOrderNumber(1_760_000_000_000);
    expect(value).toMatch(/^NV-1760000000000-[A-Z0-9]{10}$/);
  });

  it('does not repeat when orders share the same timestamp', () => {
    const values = new Set(
      Array.from({ length: 100 }, () => createOrderNumber(1_760_000_000_000)),
    );
    expect(values.size).toBe(100);
  });
});
