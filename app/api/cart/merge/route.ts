import { Prisma } from '@prisma/client';
import { noStore, unauthorized, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import {
  CART_COOKIE,
  clearCartCookieHeader,
  isCartKey,
  readCookie,
} from '@/lib/cart';
import { mergedCartQuantity } from '@/lib/cart-merge';
import { ensureUserProfile, getAuthenticatedIdentity } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Cart database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const guestKey = readCookie(request, CART_COOKIE);
  if (!guestKey || !isCartKey(guestKey)) {
    const response = noStore({ merged: false });
    if (guestKey) response.headers.set('Set-Cookie', clearCartCookieHeader());
    return response;
  }

  try {
    await ensureUserProfile(identity);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const merged = await prisma.$transaction(
          async (tx) => {
            const userCart = await tx.cart.upsert({
              where: { userId: identity.id },
              create: { userId: identity.id },
              update: {},
            });
            const guestCart = await tx.cart.findUnique({
              where: { guestKey },
              include: { items: true },
            });
            if (!guestCart || guestCart.id === userCart.id) return false;

            for (const item of guestCart.items) {
              const variant = await tx.productVariant.findFirst({
                where: { id: item.variantId, product: { status: 'PUBLISHED' } },
                select: { stockOnHand: true, stockReserved: true },
              });
              if (!variant) continue;
              const existing = await tx.cartItem.findUnique({
                where: {
                  cartId_variantId: {
                    cartId: userCart.id,
                    variantId: item.variantId,
                  },
                },
              });
              const quantity = mergedCartQuantity(
                existing?.quantity ?? 0,
                item.quantity,
                variant.stockOnHand - variant.stockReserved,
              );
              if (quantity < 1) continue;
              if (existing)
                await tx.cartItem.update({
                  where: { id: existing.id },
                  data: { quantity },
                });
              else
                await tx.cartItem.create({
                  data: {
                    cartId: userCart.id,
                    variantId: item.variantId,
                    quantity,
                  },
                });
            }
            await tx.cart.delete({ where: { id: guestCart.id } });
            return true;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        const response = noStore({ merged });
        response.headers.set('Set-Cookie', clearCartCookieHeader());
        return response;
      } catch (error) {
        const serializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!serializationConflict || attempt === 1) throw error;
      }
    }
    return noStore({ merged: false });
  } catch (error) {
    logServerError('cart_merge_failed', error);
    return unavailable('Cart merge is temporarily unavailable');
  }
}
