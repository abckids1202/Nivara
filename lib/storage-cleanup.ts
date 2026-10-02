import { prisma } from '@/lib/prisma';
import { hasConfiguredValue } from '@/lib/configuration';
import { providerFetch } from '@/lib/provider-fetch';

export function storageConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'product-images';
  return hasConfiguredValue(url, ['your-project']) &&
    hasConfiguredValue(key) &&
    hasConfiguredValue(bucket)
    ? { url, key, bucket }
    : null;
}

export function storagePathForImage(
  url: string,
  config: ReturnType<typeof storageConfig>,
) {
  if (!config) return null;
  const marker = `/storage/v1/object/public/${config.bucket}/`;
  if (!url.startsWith(`${config.url}${marker}`)) return null;
  return decodeURIComponent(url.slice(`${config.url}${marker}`.length));
}

export async function deleteStorageObject(
  path: string,
  bucket: string,
  config = storageConfig(),
) {
  if (!config) return false;
  const response = await providerFetch(
    `${config.url}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.key}`,
        apikey: config.key,
      },
    },
  );
  return response.ok || response.status === 404;
}

export async function processStorageCleanupTasks(limit = 50) {
  const config = storageConfig();
  if (!config) return { completed: 0, failed: 0, skipped: true };

  const staleProcessingAt = new Date(Date.now() - 10 * 60 * 1000);
  const tasks = await prisma.storageCleanupTask.findMany({
    where: {
      bucket: config.bucket,
      nextAttemptAt: { lte: new Date() },
      OR: [
        { status: 'PENDING' },
        { status: 'FAILED' },
        { status: 'PROCESSING', updatedAt: { lt: staleProcessingAt } },
      ],
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
  });
  let completed = 0;
  let failed = 0;

  for (const task of tasks) {
    const claimed = await prisma.storageCleanupTask.updateMany({
      where: {
        id: task.id,
        status: task.status,
        updatedAt: task.updatedAt,
      },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;

    try {
      if (!(await deleteStorageObject(task.path, task.bucket, config)))
        throw new Error('Storage provider rejected cleanup');
      await prisma.storageCleanupTask.update({
        where: { id: task.id },
        data: { status: 'COMPLETED', lastError: null },
      });
      completed += 1;
    } catch {
      await prisma.storageCleanupTask.update({
        where: { id: task.id },
        data: {
          status: 'FAILED',
          lastError: 'Storage cleanup attempt failed',
          nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      failed += 1;
    }
  }

  return { completed, failed, skipped: false };
}
