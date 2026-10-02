import {
  badRequest,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import {
  adminProductQuerySchema,
  productMutationSchema,
} from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity)))
    return { response: forbidden() } as const;
  return { identity } as const;
}

export async function GET(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  const parsedQuery = adminProductQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsedQuery.success)
    return badRequest(
      'Product search query is invalid',
      parsedQuery.error.flatten(),
    );
  try {
    const { q, page, pageSize } = parsedQuery.data;
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { slug: { contains: q, mode: 'insensitive' as const } },
            {
              category: {
                name: { contains: q, mode: 'insensitive' as const },
              },
            },
          ],
        }
      : undefined;
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: { orderBy: { sku: 'asc' } },
          images: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    return noStore({
      data: products,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    logServerError('admin_products_read_failed', error);
    return unavailable('Products are temporarily unavailable');
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  const parsed = productMutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Product details are invalid', parsed.error.flatten());

  try {
    const product = await prisma.$transaction(async (transaction) => {
      const createdProduct = await transaction.product.create({
        data: parsed.data,
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.identity.id,
          action: 'product.created',
          entityType: 'Product',
          entityId: createdProduct.id,
        },
      });
      return createdProduct;
    });
    return noStore({ data: product }, 201);
  } catch (error) {
    logServerError('product_create_failed', error);
    return unavailable('Product could not be created');
  }
}
