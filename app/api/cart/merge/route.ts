import { json, unauthorized, unavailable } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { CART_COOKIE, findOrCreateCart, readCookie } from "@/lib/cart";
import { getAuthenticatedIdentity } from "@/lib/server-auth";

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return unavailable("Cart database is not configured");
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const guestKey = readCookie(request, CART_COOKIE);
  if (!guestKey) return json({ merged: false });

  const userCart = await findOrCreateCart(identity, null);
  const guestCart = await prisma.cart.findUnique({ where: { guestKey }, include: { items: true } });
  if (!userCart || !guestCart) return json({ merged: false });

  await prisma.$transaction(async (tx) => {
    for (const item of guestCart.items) {
      const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } } });
      const quantity = Math.min(20, (existing?.quantity ?? 0) + item.quantity);
      if (existing) await tx.cartItem.update({ where: { id: existing.id }, data: { quantity } });
      else await tx.cartItem.create({ data: { cartId: userCart.id, variantId: item.variantId, quantity } });
    }
    await tx.cart.delete({ where: { id: guestCart.id } });
  });
  return json({ merged: true });
}
