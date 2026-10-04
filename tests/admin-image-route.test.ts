import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  findImage,
  findProduct,
  createImage,
  deleteImage,
  createAudit,
  createCleanup,
  transaction,
  providerFetch,
  deleteStorageObject,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  findImage: vi.fn(),
  findProduct: vi.fn(),
  createImage: vi.fn(),
  deleteImage: vi.fn(),
  createAudit: vi.fn(),
  createCleanup: vi.fn(),
  transaction: vi.fn(),
  providerFetch: vi.fn(),
  deleteStorageObject: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findUnique: findProduct },
    productImage: { findFirst: findImage },
    $transaction: transaction,
  },
}));
vi.mock('@/lib/provider-fetch', () => ({ providerFetch }));
vi.mock('@/lib/storage-cleanup', () => ({
  storageConfig: () => ({
    url: 'https://nivara.supabase.co',
    key: 'server-key',
    bucket: 'product-images',
  }),
  isConfiguredStoragePublicUrl: () => false,
  storagePathForImage: () => 'lamp/image.webp',
  deleteStorageObject,
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { DELETE, POST } from '@/app/api/admin/products/[id]/images/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findImage.mockReset();
  findProduct.mockReset();
  createImage.mockReset();
  deleteImage.mockReset();
  createAudit.mockReset();
  createCleanup.mockReset();
  transaction.mockReset();
  providerFetch.mockReset();
  deleteStorageObject.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

function configureDatabase() {
  process.env.DATABASE_URL = 'postgresql://database.example/nivara';
  getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
  isAdministrator.mockResolvedValue(true);
}

describe('admin product image lifecycle', () => {
  it('queues storage cleanup within the image deletion transaction', async () => {
    configureDatabase();
    findImage.mockResolvedValue({
      id: 'image-1',
      productId: 'product-1',
      url: 'https://nivara.supabase.co/storage/v1/object/public/product-images/lamp/image.webp',
    });
    transaction.mockImplementation(async (callback) =>
      callback({
        productImage: { delete: deleteImage },
        auditLog: { create: createAudit },
        storageCleanupTask: { create: createCleanup },
      }),
    );

    const response = await DELETE(
      new Request(
        'https://nivara.example/api/admin/products/product-1/images?imageId=image-1',
      ),
      { params: Promise.resolve({ id: 'product-1' }) },
    );

    expect(response.status).toBe(200);
    expect(deleteImage).toHaveBeenCalledWith({ where: { id: 'image-1' } });
    expect(createAudit).toHaveBeenCalled();
    expect(createCleanup).toHaveBeenCalledWith({
      data: { bucket: 'product-images', path: 'lamp/image.webp' },
    });
    expect(deleteStorageObject).not.toHaveBeenCalled();
  });

  it('compensates the uploaded object when metadata or audit persistence fails', async () => {
    configureDatabase();
    findProduct.mockResolvedValue({
      id: 'product-1',
      slug: 'lamp',
      name: 'Lamp',
    });
    providerFetch.mockResolvedValue(new Response(null, { status: 201 }));
    transaction.mockImplementation(async (callback) =>
      callback({
        productImage: { create: createImage },
        auditLog: { create: createAudit },
      }),
    );
    createImage.mockResolvedValue({ id: 'image-1' });
    createAudit.mockRejectedValue(new Error('audit unavailable'));
    deleteStorageObject.mockResolvedValue(true);

    const form = new FormData();
    form.set(
      'file',
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        'lamp.png',
        { type: 'image/png' },
      ),
    );
    const response = await POST(
      new Request('https://nivara.example/api/admin/products/product-1/images', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ id: 'product-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(providerFetch).toHaveBeenCalledWith(
      expect.stringContaining('/storage/v1/object/product-images/lamp/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Cache-Control': 'public, max-age=31536000, immutable',
        }),
      }),
    );
    expect(body.error).toBe('Image metadata or audit record could not be saved');
    expect(deleteStorageObject).toHaveBeenCalledWith(
      expect.stringMatching(/^lamp\//),
      'product-images',
      expect.objectContaining({ bucket: 'product-images' }),
    );
  });
});
