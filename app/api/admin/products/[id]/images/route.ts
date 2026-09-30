import { randomUUID } from 'node:crypto';
import {
  badRequest,
  forbidden,
  json,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { providerFetch } from '@/lib/provider-fetch';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity)))
    return { response: forbidden() } as const;
  return { identity } as const;
}

function storageConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'product-images';
  return url && key && key !== 'replace-me-server-only'
    ? { url, key, bucket }
    : null;
}

function storagePathForImage(url: string, config: ReturnType<typeof storageConfig>) {
  if (!config) return null;
  const marker = `/storage/v1/object/public/${config.bucket}/`;
  if (!url.startsWith(`${config.url}${marker}`)) return null;
  return decodeURIComponent(url.slice(`${config.url}${marker}`.length));
}

async function deleteStorageObject(path: string, config: NonNullable<ReturnType<typeof storageConfig>>) {
  const response = await providerFetch(
    `${config.url}/storage/v1/object/${config.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const config = storageConfig();
  if (!config) return unavailable('Supabase Storage is not configured');
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true },
  });
  if (!product) return json({ error: 'Product not found' }, 404);
  const form = await request.formData();
  const file = form.get('file');
  const rawAltText = form.get('altText');
  const altText = (typeof rawAltText === 'string' ? rawAltText : product.name)
    .trim()
    .slice(0, 200);
  if (!(file instanceof File)) return badRequest('An image file is required');
  if (!allowedTypes.has(file.type))
    return badRequest('Use a JPG, PNG, or WebP image');
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES)
    return badRequest('Images must be smaller than 5 MB');
  const extension =
    file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${product.slug}/${randomUUID()}.${extension}`;
  const upload = await providerFetch(
    `${config.url}/storage/v1/object/${config.bucket}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        apikey: config.key,
        'Content-Type': file.type,
        'x-upsert': 'false',
      },
      body: await file.arrayBuffer(),
    },
  );
  if (!upload.ok)
    return unavailable('Supabase Storage could not save the image');
  let image;
  try {
    image = await prisma.productImage.create({
      data: {
        productId: product.id,
        url: `${config.url}/storage/v1/object/public/${config.bucket}/${path}`,
        altText: altText || product.name,
      },
    });
  } catch {
    await deleteStorageObject(path, config).catch(() => undefined);
    return unavailable('Image metadata could not be saved');
  }
  await prisma.auditLog.create({
    data: {
      actorId: access.identity.id,
      action: 'product.image.created',
      entityType: 'ProductImage',
      entityId: image.id,
      details: { productId: product.id, path },
    },
  });
  return json({ data: image }, 201);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const { id } = await params;
  const imageId = new URL(request.url).searchParams.get('imageId');
  if (!imageId) return badRequest('imageId is required');
  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId: id },
  });
  if (!image) return json({ error: 'Image not found' }, 404);
  const config = storageConfig();
  const path = storagePathForImage(image.url, config);
  if (path && config && !(await deleteStorageObject(path, config)))
    return unavailable('Supabase Storage could not remove the image');
  await prisma.productImage.delete({ where: { id: image.id } });
  await prisma.auditLog.create({
    data: {
      actorId: access.identity.id,
      action: 'product.image.deleted',
      entityType: 'ProductImage',
      entityId: image.id,
      details: { productId: id, path },
    },
  });
  return json({ deleted: true });
}
