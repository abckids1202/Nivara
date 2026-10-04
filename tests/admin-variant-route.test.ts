import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const {
  findFirst,
  create,
  update,
  createAudit,
  transaction,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productVariant: { findFirst, create },
    auditLog: {},
    $transaction: transaction,
  },
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { POST } from '@/app/api/admin/products/[id]/variants/route';
import { PATCH } from '@/app/api/admin/products/[id]/variants/[variantId]/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findFirst.mockReset();
  create.mockReset();
  update.mockReset();
  createAudit.mockReset();
  transaction.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

describe('admin variant route resilience', () => {
  it('rejects a comparison price below the selling price on creation', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    isAdministrator.mockResolvedValue(true);

    const response = await POST(
      new Request(
        'https://nivara.example/api/admin/products/product-1/variants',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Large',
            sku: 'ARC-LARGE',
            priceRupees: 799,
            compareAtRupees: 699,
            stockOnHand: 8,
          }),
        },
      ),
      { params: Promise.resolve({ id: 'product-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Comparison price must be at least the selling price');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns a conflict when creating a duplicate SKU', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    isAdministrator.mockResolvedValue(true);
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate sku', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const response = await POST(
      new Request(
        'https://nivara.example/api/admin/products/product-1/variants',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Large',
            sku: 'ARC-1',
            priceRupees: 799,
            stockOnHand: 8,
          }),
        },
      ),
      { params: Promise.resolve({ id: 'product-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('That SKU is already in use');
    expect(logServerError).not.toHaveBeenCalled();
  });

  it('returns a conflict when editing a variant to a duplicate SKU', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    isAdministrator.mockResolvedValue(true);
    findFirst.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      pricePaise: 64900,
      compareAtPaise: null,
    });
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate sku', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const response = await PATCH(
      new Request(
        'https://nivara.example/api/admin/products/product-1/variants/variant-1',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sku: 'ARC-1' }),
        },
      ),
      { params: Promise.resolve({ id: 'product-1', variantId: 'variant-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('That SKU is already in use');
    expect(logServerError).not.toHaveBeenCalled();
  });

  it('returns a safe response when the variant cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
    });
    isAdministrator.mockResolvedValue(true);
    findFirst.mockRejectedValue(new Error('private variant details'));

    const response = await PATCH(
      new Request(
        'https://nivara.example/api/admin/products/product-1/variants/variant-1',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Natural' }),
        },
      ),
      { params: Promise.resolve({ id: 'product-1', variantId: 'variant-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Variant update is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'admin_variant_update_failed',
      expect.any(Error),
    );
  });

  it('creates a variant with paise conversion and an audit record', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
    });
    isAdministrator.mockResolvedValue(true);
    const createdVariant = {
      id: 'variant-2',
      productId: 'product-1',
      name: 'Large',
      sku: 'ARC-LARGE',
      pricePaise: 79900,
      compareAtPaise: 89900,
      stockOnHand: 8,
    };
    create.mockResolvedValue(createdVariant);
    createAudit.mockResolvedValue({ id: 'audit-2' });
    transaction.mockImplementation(async (callback) =>
      callback({
        productVariant: { create },
        auditLog: { create: createAudit },
      }),
    );

    const response = await POST(
      new Request(
        'https://nivara.example/api/admin/products/product-1/variants',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Large',
            sku: 'ARC-LARGE',
            priceRupees: 799,
            compareAtRupees: 899,
            stockOnHand: 8,
          }),
        },
      ),
      { params: Promise.resolve({ id: 'product-1' }) },
    );
    const body = (await response.json()) as { data: typeof createdVariant };

    expect(response.status).toBe(201);
    expect(body.data).toEqual(createdVariant);
    expect(create).toHaveBeenCalledWith({
      data: {
        productId: 'product-1',
        name: 'Large',
        sku: 'ARC-LARGE',
        pricePaise: 79900,
        compareAtPaise: 89900,
        stockOnHand: 8,
      },
    });
    expect(createAudit).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'variant.created',
        entityType: 'ProductVariant',
        entityId: 'variant-2',
        details: {
          name: 'Large',
          sku: 'ARC-LARGE',
          priceRupees: 799,
          compareAtRupees: 899,
          stockOnHand: 8,
        },
      },
    });
  });

  it('does not report success when the audit record cannot be written', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
    });
    isAdministrator.mockResolvedValue(true);
    findFirst.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      pricePaise: 10000,
      compareAtPaise: null,
    });
    transaction.mockImplementation(async (callback) =>
      callback({
        productVariant: { update },
        auditLog: { create: createAudit },
      }),
    );
    update.mockResolvedValue({ id: 'variant-1' });
    createAudit.mockRejectedValue(new Error('audit unavailable'));

    const response = await PATCH(
      new Request(
        'https://nivara.example/api/admin/products/product-1/variants/variant-1',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Natural' }),
        },
      ),
      { params: Promise.resolve({ id: 'product-1', variantId: 'variant-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Variant update is temporarily unavailable');
    expect(logServerError).toHaveBeenCalledWith(
      'admin_variant_update_failed',
      expect.any(Error),
    );
  });
});
