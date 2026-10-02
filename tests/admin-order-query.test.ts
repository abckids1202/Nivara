import { describe, expect, it } from 'vitest';
import { adminOrderQuerySchema } from '@/lib/schemas';

describe('administrator order search validation', () => {
  it('trims a bounded search query', () => {
    expect(adminOrderQuerySchema.parse({ q: '  NV-123  ' })).toEqual({
      q: 'NV-123',
    });
  });

  it('rejects oversized search text', () => {
    expect(
      adminOrderQuerySchema.safeParse({ q: 'x'.repeat(121) }).success,
    ).toBe(false);
  });
});
