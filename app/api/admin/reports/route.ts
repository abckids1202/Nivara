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
    const [paidOrders, reviewOrders, adjustments, variants] = await Promise.all(
      [
        prisma.order.findMany({
          where: { paymentStatus: 'PAID' },
          select: { totalPaise: true },
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
        prisma.productVariant.findMany({
          where: { product: { status: 'PUBLISHED' } },
          include: { product: { select: { name: true, slug: true } } },
          orderBy: { stockOnHand: 'asc' },
        }),
      ],
    );
    const lowStock = variants
      .filter((variant) => variant.stockOnHand - variant.stockReserved < 7)
      .slice(0, 50);
    return noStore({
      data: {
        paidOrderCount: paidOrders.length,
        paidOrderTotalPaise: paidOrders.reduce(
          (sum, order) => sum + order.totalPaise,
          0,
        ),
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
