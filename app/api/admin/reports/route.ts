import { Prisma } from '@prisma/client';
import { forbidden, noStore, unauthorized, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

export async function GET(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Reporting database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  if (!(await isAdministrator(identity))) return forbidden();

  try {
    type LowStockRow = {
      id: string;
      name: string;
      sku: string;
      stockOnHand: number;
      stockReserved: number;
      productName: string;
      productSlug: string;
    };

    const [paidOrderTotals, reviewOrders, adjustments, lowStockRows] = await Promise.all(
      [
        prisma.order.aggregate({
          where: { paymentStatus: 'PAID' },
          _count: { _all: true },
          _sum: { totalPaise: true },
        }),
        prisma.order.count({
          where: { paymentStatus: { in: ['PAYMENT_REVIEW', 'PAID_REVIEW'] } },
        }),
        prisma.inventoryAdjustment.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            variant: { include: { product: { select: { name: true } } } },
            adminUser: { select: { email: true, displayName: true } },
          },
        }),
        prisma.$queryRaw<LowStockRow[]>(Prisma.sql`
          SELECT
            variant."id",
            variant."name",
            variant."sku",
            variant."stockOnHand",
            variant."stockReserved",
            product."name" AS "productName",
            product."slug" AS "productSlug"
          FROM "ProductVariant" AS variant
          INNER JOIN "Product" AS product ON product."id" = variant."productId"
          WHERE product."status" = 'PUBLISHED'
            AND variant."stockOnHand" - variant."stockReserved" < 7
          ORDER BY
            variant."stockOnHand" - variant."stockReserved" ASC,
            variant."id" ASC
          LIMIT 50
        `),
      ],
    );
    const lowStock = lowStockRows.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      stockOnHand: variant.stockOnHand,
      stockReserved: variant.stockReserved,
      product: { name: variant.productName, slug: variant.productSlug },
    }));
    return noStore({
      data: {
        paidOrderCount: paidOrderTotals._count._all,
        paidOrderTotalPaise: paidOrderTotals._sum.totalPaise ?? 0,
        paymentReviewCount: reviewOrders,
        lowStock,
        adjustments,
      },
    });
  } catch (error) {
    logServerError('admin_reports_read_failed', error);
    return unavailable('Reports are temporarily unavailable');
  }
}
