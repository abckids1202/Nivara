import { badRequest, noStore, unauthorized, unavailable } from '@/lib/http';
import { cartItemSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import {
  cartCookieHeader,
  createCartKey,
  findOrCreateCart,
  readCookie,
  CART_COOKIE,
} from '@/lib/cart';
import { getAuthenticatedIdentity } from '@/lib/server-auth';

function serialize(
  cart: NonNullable<Awaited<ReturnType<typeof findOrCreateCart>>>,
) {
  return cart.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    variantId: item.variantId,
    variant: {
      name: item.variant.name,
      sku: item.variant.sku,
      pricePaise: item.variant.pricePaise,
      stockOnHand: item.variant.stockOnHand,
      stockReserved: item.variant.stockReserved,
      product: {
        name: item.variant.product.name,
        slug: item.variant.product.slug,
      },
    },
  }));
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Cart database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  const guestKey = readCookie(request, CART_COOKIE);
  const cart = await findOrCreateCart(identity, guestKey);
  if (!cart) return noStore({ data: [] });
  return noStore({ data: serialize(cart) });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Cart database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  const createdGuestKey = identity
    ? null
    : (readCookie(request, CART_COOKIE) ?? createCartKey());
  const parsed = cartItemSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Cart item is invalid', parsed.error.flatten());

  const variant = await prisma.productVariant.findFirst({
    where: { id: parsed.data.variantId, product: { status: 'PUBLISHED' } },
    select: { id: true, stockOnHand: true, stockReserved: true },
  });
  if (!variant) return badRequest('Variant is not available');
  if (variant.stockOnHand - variant.stockReserved < parsed.data.quantity)
    return badRequest('Not enough stock is available');

  const cart = await findOrCreateCart(identity, createdGuestKey);
  if (!cart) return unauthorized();
  const existing = cart.items.find(
    (item) => item.variantId === parsed.data.variantId,
  );
  const nextQuantity = (existing?.quantity ?? 0) + parsed.data.quantity;
  if (
    nextQuantity > 20 ||
    nextQuantity > variant.stockOnHand - variant.stockReserved
  )
    return badRequest('Requested cart quantity is unavailable');

  const updated = await prisma.cartItem.upsert({
    where: {
      cartId_variantId: { cartId: cart.id, variantId: parsed.data.variantId },
    },
    create: {
      cartId: cart.id,
      variantId: parsed.data.variantId,
      quantity: parsed.data.quantity,
    },
    update: { quantity: nextQuantity },
    include: { variant: { include: { product: true } } },
  });
  const response = noStore(
    { data: { id: updated.id, quantity: updated.quantity } },
    201,
  );
  if (!identity && createdGuestKey)
    response.headers.set('Set-Cookie', cartCookieHeader(createdGuestKey));
  return response;
}

export async function PATCH(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Cart database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  const guestKey = readCookie(request, CART_COOKIE);
  const cart = await findOrCreateCart(identity, guestKey);
  if (!cart) return badRequest('Cart was not found');
  const body = (await request.json().catch(() => null)) as {
    itemId?: string;
    quantity?: number;
  } | null;
  const parsed = zCartUpdate(body);
  if (!parsed) return badRequest('Cart update is invalid');
  const item = cart.items.find((candidate) => candidate.id === parsed.itemId);
  if (!item) return badRequest('Cart item was not found');
  if (item.variant.stockOnHand - item.variant.stockReserved < parsed.quantity)
    return badRequest('Not enough stock is available');
  const updated = await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: parsed.quantity },
  });
  return noStore({ data: { id: updated.id, quantity: updated.quantity } });
}

export async function DELETE(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Cart database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  const guestKey = readCookie(request, CART_COOKIE);
  const cart = await findOrCreateCart(identity, guestKey);
  if (!cart) return noStore({ data: [] });
  const itemId = new URL(request.url).searchParams.get('itemId');
  if (itemId)
    await prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
  else await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return noStore({ data: [] });
}

function zCartUpdate(
  body: { itemId?: string; quantity?: number } | null,
): { itemId: string; quantity: number } | null {
  const quantity = body?.quantity;
  if (
    !body?.itemId ||
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 20
  )
    return null;
  return { itemId: body.itemId, quantity };
}
