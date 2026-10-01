import { Prisma } from '@prisma/client';
import { json, unauthorized, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { CART_COOKIE, readCookie } from '@/lib/cart';
import {
  ensureUserProfile,
  getAuthenticatedIdentity,
} from '@/lib/server-auth';

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Cart database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const guestKey = readCookie(request, CART_COOKIE);
  if (!guestKey) return json({ merged: false });

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
            const existing = await tx.cartItem.findUnique({
              where: {
                cartId_variantId: {
                  cartId: userCart.id,
                  variantId: item.variantId,
                },
              },
            });
            const quantity = Math.min(
              20,
              (existing?.quantity ?? 0) + item.quantity,
            );
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
      return json({ merged });
    } catch (error) {
      const serializationConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!serializationConflict || attempt === 1) throw error;
    }
  }
  return json({ merged: false });
}
