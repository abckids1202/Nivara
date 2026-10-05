import { describe, expect, it } from 'vitest';
import {
  canPromoteAdmin,
  isVerifiedSupabaseUser,
} from '@/lib/admin-bootstrap';

const baseUser = {
  id: 'user-1',
  email: 'owner@example.com',
  email_confirmed_at: '2026-10-05T00:00:00.000Z',
};

describe('administrator bootstrap verification', () => {
  it('recognizes either Supabase verification timestamp', () => {
    expect(isVerifiedSupabaseUser(baseUser)).toBe(true);
    expect(isVerifiedSupabaseUser({ confirmed_at: '2026-10-05T00:00:00Z' })).toBe(true);
    expect(isVerifiedSupabaseUser({ email_confirmed_at: null, confirmed_at: null })).toBe(false);
  });

  it('requires matching ID, email, and verification', () => {
    expect(
      canPromoteAdmin({
        applicationUserId: 'user-1',
        applicationEmail: 'OWNER@example.com',
        supabaseUser: baseUser,
      }),
    ).toBe(true);
    expect(
      canPromoteAdmin({
        applicationUserId: 'different-user',
        applicationEmail: 'owner@example.com',
        supabaseUser: baseUser,
      }),
    ).toBe(false);
    expect(
      canPromoteAdmin({
        applicationUserId: 'user-1',
        applicationEmail: 'other@example.com',
        supabaseUser: baseUser,
      }),
    ).toBe(false);
    expect(
      canPromoteAdmin({
        applicationUserId: 'user-1',
        applicationEmail: 'owner@example.com',
        supabaseUser: { ...baseUser, email_confirmed_at: null },
      }),
    ).toBe(false);
    expect(
      canPromoteAdmin({
        applicationUserId: 'user-1',
        applicationEmail: 'owner@example.com',
        supabaseUser: null,
      }),
    ).toBe(false);
  });
});
