import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ensureUserProfile, type AuthenticatedIdentity } from "@/lib/server-auth";

export const CART_COOKIE = "nivara-cart-key";

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function createCartKey() {
  return randomBytes(18).toString("base64url");
}

export async function findOrCreateCart(identity: AuthenticatedIdentity | null, guestKey: string | null) {
  if (identity) {
    await ensureUserProfile(identity);
    return prisma.cart.upsert({
      where: { userId: identity.id },
      create: { userId: identity.id },
      update: {},
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
  }
  if (!guestKey) return null;
  return prisma.cart.upsert({
    where: { guestKey },
    create: { guestKey },
    update: {},
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
}

export function cartCookieHeader(value: string) {
  return `${CART_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`;
}
