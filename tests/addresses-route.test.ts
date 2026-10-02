import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  findMany,
  createAddress,
  deleteMany,
  ensureUserProfile,
  getIdentity,
  logServerError,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  createAddress: vi.fn(),
  deleteMany: vi.fn(),
  ensureUserProfile: vi.fn(),
  getIdentity: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    address: { findMany, create: createAddress, deleteMany },
  },
}));
vi.mock('@/lib/server-auth', () => ({
  ensureUserProfile,
  getAuthenticatedIdentity: getIdentity,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { DELETE, GET, POST } from '@/app/api/account/addresses/route';

const originalEnvironment = { ...process.env };
const identity = { id: 'user-1', email: 'shopper@example.com' };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findMany.mockReset();
  createAddress.mockReset();
  deleteMany.mockReset();
  ensureUserProfile.mockReset();
  getIdentity.mockReset();
  logServerError.mockReset();
});

describe('address route resilience', () => {
  it('returns a safe response when address reads fail', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue(identity);
    findMany.mockRejectedValue(new Error('private address details'));

    const response = await GET(
      new Request('https://nivara.example/api/account/addresses'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Addresses are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'address_read_failed',
      expect.any(Error),
    );
  });

  it('returns a safe response when address creation fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue(identity);
    ensureUserProfile.mockResolvedValue(identity);
    createAddress.mockRejectedValue(new Error('private create details'));

    const response = await POST(
      new Request('https://nivara.example/api/account/addresses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test Shopper',
          line1: '1 Example Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'IN',
        }),
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Addresses are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'address_create_failed',
      expect.any(Error),
    );
  });

  it('returns a safe response when address deletion fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue(identity);
    deleteMany.mockRejectedValue(new Error('private delete details'));

    const response = await DELETE(
      new Request('https://nivara.example/api/account/addresses?id=address-1'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Addresses are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'address_delete_failed',
      expect.any(Error),
    );
  });
});
