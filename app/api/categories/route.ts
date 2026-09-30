import { json, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!process.env.DATABASE_URL)
    return unavailable('Category database is not configured');
  const categories = await prisma.category.findMany({
    where: { products: { some: { status: 'PUBLISHED' } } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
  return json({ data: categories });
}
