import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany, updateMany, update, providerFetch } = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  providerFetch: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    storageCleanupTask: { findMany, updateMany, update },
  },
}));
vi.mock('@/lib/provider-fetch', () => ({ providerFetch }));

import { processStorageCleanupTasks } from '@/lib/storage-cleanup';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findMany.mockReset();
  updateMany.mockReset();
  update.mockReset();
  providerFetch.mockReset();
});

function configureStorage() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://nivara.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-key';
  process.env.SUPABASE_STORAGE_BUCKET = 'product-images';
}

function task() {
  return {
    id: 'cleanup-1',
    bucket: 'product-images',
    path: 'lamp/image.webp',
    status: 'PENDING',
    updatedAt: new Date('2026-10-02T00:00:00.000Z'),
  };
}

describe('storage cleanup worker', () => {
  it('claims and completes a provider deletion', async () => {
    configureStorage();
    findMany.mockResolvedValue([task()]);
    updateMany.mockResolvedValue({ count: 1 });
    providerFetch.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(processStorageCleanupTasks()).resolves.toEqual({
      completed: 1,
      failed: 0,
      skipped: false,
    });

    expect(providerFetch).toHaveBeenCalledWith(
      'https://nivara.supabase.co/storage/v1/object/product-images/lamp/image.webp',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cleanup-1' },
      data: { status: 'COMPLETED', lastError: null },
    });
  });

  it('records a retryable failure when the provider rejects cleanup', async () => {
    configureStorage();
    findMany.mockResolvedValue([task()]);
    updateMany.mockResolvedValue({ count: 1 });
    providerFetch.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(processStorageCleanupTasks()).resolves.toEqual({
      completed: 0,
      failed: 1,
      skipped: false,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cleanup-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'Storage cleanup attempt failed',
        nextAttemptAt: expect.any(Date),
      }),
    });
  });

  it('does not call the provider when another worker claimed the task', async () => {
    configureStorage();
    findMany.mockResolvedValue([task()]);
    updateMany.mockResolvedValue({ count: 0 });

    await expect(processStorageCleanupTasks()).resolves.toEqual({
      completed: 0,
      failed: 0,
      skipped: false,
    });
    expect(providerFetch).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
