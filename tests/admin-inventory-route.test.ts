import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  queryRaw,
  update,
  createAdjustment,
  createAudit,
  transaction,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  update: vi.fn(),
  createAdjustment: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: transaction },
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { POST } from '@/app/api/admin/inventory/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  queryRaw.mockReset();
  update.mockReset();
  createAdjustment.mockReset();
  createAudit.mockReset();
  transaction.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

function request(body: Record<string, unknown>) {
  return new Request('https://nivara.example/api/admin/inventory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin inventory adjustment route', () => {
  it('requires an authenticated administrator before opening a transaction', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue(null);

    const response = await POST(
      request({ variantId: 'variant-1', quantityDelta: 2, reason: 'Restock' }),
    );

    expect(response.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
    expect(isAdministrator).not.toHaveBeenCalled();
  });

  it('does not reduce stock below the active reservation quantity', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    isAdministrator.mockResolvedValue(true);
    transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: queryRaw,
        productVariant: { update },
        inventoryAdjustment: { create: createAdjustment },
        auditLog: { create: createAudit },
      }),
    );
    queryRaw.mockResolvedValue([{ stockOnHand: 4, stockReserved: 3 }]);

    const response = await POST(
      request({ variantId: 'variant-1', quantityDelta: -2, reason: 'Damage' }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Stock cannot be reduced below reserved quantity');
    expect(update).not.toHaveBeenCalled();
    expect(createAdjustment).not.toHaveBeenCalled();
    expect(createAudit).not.toHaveBeenCalled();
  });

  it('locks the variant, updates stock, and records both audit entries', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    isAdministrator.mockResolvedValue(true);
    queryRaw.mockResolvedValue([{ stockOnHand: 4, stockReserved: 1 }]);
    const updated = {
      id: 'variant-1',
      sku: 'ARC-1',
      stockOnHand: 7,
      stockReserved: 1,
    };
    update.mockResolvedValue(updated);
    createAdjustment.mockResolvedValue({ id: 'adjustment-1' });
    createAudit.mockResolvedValue({ id: 'audit-1' });
    transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: queryRaw,
        productVariant: { update },
        inventoryAdjustment: { create: createAdjustment },
        auditLog: { create: createAudit },
      }),
    );

    const response = await POST(
      request({ variantId: 'variant-1', quantityDelta: 3, reason: 'New stock' }),
    );
    const body = (await response.json()) as { data: typeof updated };

    expect(response.status).toBe(200);
    expect(body.data).toEqual(updated);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: { stockOnHand: 7 },
      select: { id: true, sku: true, stockOnHand: true, stockReserved: true },
    });
    expect(createAdjustment).toHaveBeenCalledWith({
      data: {
        variantId: 'variant-1',
        adminUserId: 'admin-1',
        quantityDelta: 3,
        beforeQuantity: 4,
        afterQuantity: 7,
        reason: 'New stock',
      },
    });
    expect(createAudit).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'inventory.adjusted',
        entityType: 'ProductVariant',
        entityId: 'variant-1',
        details: { quantityDelta: 3, reason: 'New stock' },
      },
    });
  });
});
