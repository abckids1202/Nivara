import { getAuthenticatedIdentity, ensureUserProfile } from '@/lib/server-auth';
import { badRequest, noStore, unauthorized, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const wishlistMutationSchema = z.object({ productId: z.string().min(1) });

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Wishlist database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: identity.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: { orderBy: { sortOrder: 'asc' }, take: 1 },
              variants: true,
            },
          },
        },
      },
    },
  });
  return noStore({ data: wishlist?.items ?? [] });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Wishlist database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const parsed = wishlistMutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return badRequest('Wishlist item is invalid');
  await ensureUserProfile(identity);
  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, status: 'PUBLISHED' },
  });
  if (!product) return badRequest('Product is not available');
  const wishlist = await prisma.wishlist.upsert({
    where: { userId: identity.id },
    create: { userId: identity.id },
    update: {},
  });
  const item = await prisma.wishlistItem.upsert({
    where: {
      wishlistId_productId: { wishlistId: wishlist.id, productId: product.id },
    },
    create: { wishlistId: wishlist.id, productId: product.id },
    update: {},
  });
  return noStore({ data: item }, 201);
}

export async function DELETE(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Wishlist database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const productId = new URL(request.url).searchParams.get('productId');
  if (!productId) return badRequest('productId is required');
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: identity.id },
  });
  if (wishlist)
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id, productId },
    });
  return noStore({ deleted: true });
}
