import { randomUUID } from 'node:crypto';
import {
  badRequest,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { providerFetch } from '@/lib/provider-fetch';
import { hasAllowedImageSignature } from '@/lib/image-validation';
import {
  deleteStorageObject,
  isConfiguredStoragePublicUrl,
  storageConfig,
  storagePathForImage,
} from '@/lib/storage-cleanup';
import { logServerError } from '@/lib/safe-logging';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity)))
    return { response: forbidden() } as const;
  return { identity } as const;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  const config = storageConfig();
  if (!config) return unavailable('Supabase Storage is not configured');
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true, name: true },
    });
    if (!product) return noStore({ error: 'Product not found' }, 404);
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
    const imageBytes = new Uint8Array(await file.arrayBuffer());
    if (!hasAllowedImageSignature(file.type, imageBytes))
      return badRequest('The image file contents do not match its type');
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
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-upsert': 'false',
        },
        body: imageBytes,
      },
    );
    if (!upload.ok)
      return unavailable('Supabase Storage could not save the image');
    let image;
    try {
      image = await prisma.$transaction(async (transaction) => {
        const createdImage = await transaction.productImage.create({
          data: {
            productId: product.id,
            url: `${config.url}/storage/v1/object/public/${config.bucket}/${path}`,
            altText: altText || product.name,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId: access.identity.id,
            action: 'product.image.created',
            entityType: 'ProductImage',
            entityId: createdImage.id,
            details: { productId: product.id, path },
          },
        });
        return createdImage;
      });
    } catch {
      await deleteStorageObject(path, config.bucket, config).catch(
        () => undefined,
      );
      return unavailable('Image metadata or audit record could not be saved');
    }
    return noStore({ data: image }, 201);
  } catch (error) {
    logServerError('product_image_upload_failed', error);
    return unavailable('Image upload is temporarily unavailable');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  try {
    const { id } = await params;
    const imageId = new URL(request.url).searchParams.get('imageId');
    if (!imageId) return badRequest('imageId is required');
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
    });
    if (!image) return noStore({ error: 'Image not found' }, 404);
    const config = storageConfig();
    if (!config && isConfiguredStoragePublicUrl(image.url))
      return unavailable('Supabase Storage is not configured');
    const path = storagePathForImage(image.url, config);
    await prisma.$transaction(async (transaction) => {
      await transaction.productImage.delete({ where: { id: image.id } });
      await transaction.auditLog.create({
        data: {
          actorId: access.identity.id,
          action: 'product.image.deleted',
          entityType: 'ProductImage',
          entityId: image.id,
          details: { productId: id, path },
        },
      });
      if (path && config) {
        await transaction.storageCleanupTask.create({
          data: { bucket: config.bucket, path },
        });
      }
    });
    return noStore({ deleted: true, storageCleanup: path ? 'queued' : 'not-applicable' });
  } catch (error) {
    logServerError('product_image_delete_failed', error);
    return unavailable('Image removal is temporarily unavailable');
  }
}
