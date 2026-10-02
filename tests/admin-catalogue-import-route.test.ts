import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  categoryUpsert,
  productUpsert,
  queryRaw,
  variantFindUnique,
  variantUpsert,
  auditCreate,
  transaction,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  categoryUpsert: vi.fn(),
  productUpsert: vi.fn(),
  queryRaw: vi.fn(),
  variantFindUnique: vi.fn(),
  variantUpsert: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { POST } from '@/app/api/admin/catalogue/import/route';

const originalEnvironment = { ...process.env };
const header =
  'categorySlug,categoryName,productName,productSlug,description,material,dimensions,care,status,variantName,sku,priceRupees,compareAtRupees,stockOnHand,imageUrl,imageAlt';
const row =
  'organise,Organise,Desk organiser,desk-organiser,A useful piece thoughtfully made,Oak,24 x 12 cm,Wipe clean,DRAFT,Natural,NIV-001,1499,,8,,';

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  categoryUpsert.mockReset();
  productUpsert.mockReset();
  queryRaw.mockReset();
  variantFindUnique.mockReset();
  variantUpsert.mockReset();
  auditCreate.mockReset();
  transaction.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

function configureAdmin() {
  process.env.DATABASE_URL = 'postgresql://database.example/nivara';
  getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
  isAdministrator.mockResolvedValue(true);
}

describe('admin catalogue import route', () => {
  it('returns a dry-run preview without opening a database transaction', async () => {
    configureAdmin();

    const response = await POST(
      new Request('https://nivara.example/api/admin/catalogue/import', {
        method: 'POST',
        body: `${header}\n${row}`,
      }),
    );
    const body = (await response.json()) as {
      dryRun?: boolean;
      rowCount?: number;
    };

    expect(response.status).toBe(200);
    expect(body.dryRun).toBe(true);
    expect(body.rowCount).toBe(1);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('uses the extended transaction window for a committed import', async () => {
    configureAdmin();
    categoryUpsert.mockResolvedValue({ id: 'category-1' });
    productUpsert.mockResolvedValue({ id: 'product-1' });
    variantFindUnique.mockResolvedValue(null);
    variantUpsert.mockResolvedValue({ id: 'variant-1' });
    auditCreate.mockResolvedValue({ id: 'audit-1' });
    transaction.mockImplementation(async (callback) =>
      callback({
        category: { upsert: categoryUpsert },
        product: { upsert: productUpsert },
        $queryRaw: queryRaw,
        productVariant: {
          findUnique: variantFindUnique,
          upsert: variantUpsert,
        },
        auditLog: { create: auditCreate },
      }),
    );

    const response = await POST(
      new Request(
        'https://nivara.example/api/admin/catalogue/import?dryRun=false',
        { method: 'POST', body: `${header}\n${row}` },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ imported: 1 });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 60_000,
    });
    expect(auditCreate).toHaveBeenCalled();
  });
});
