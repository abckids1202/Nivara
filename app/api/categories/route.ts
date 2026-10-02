import { noStore, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { logServerError } from '@/lib/safe-logging';

export async function GET() {
  if (!process.env.DATABASE_URL)
    return unavailable('Category database is not configured');
  try {
    const categories = await prisma.category.findMany({
      where: { products: { some: { status: 'PUBLISHED' } } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    return noStore({ data: categories });
  } catch (error) {
    logServerError('categories_query_failed', error);
    return unavailable('Categories are temporarily unavailable');
  }
}
