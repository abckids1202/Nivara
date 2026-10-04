import { PrismaClient, ProductStatus } from '@prisma/client';
import { products } from '../lib/demo-data.ts';

if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_DEMO_SEED !== 'true'
) {
  console.error(
    'Demo seed refused in production. Set ALLOW_DEMO_SEED=true only for an intentional rehearsal database.',
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

async function seed() {
  await prisma.$transaction(async (tx) => {
    const categoryNames = [
      ...new Set(products.map((product) => product.category)),
    ];
    const categories = new Map<string, { id: string }>();

    for (const name of categoryNames) {
      const category = await tx.category.upsert({
        where: { slug: slugify(name) },
        update: { name },
        create: { name, slug: slugify(name) },
        select: { id: true },
      });
      categories.set(name, category);
    }

    for (const product of products) {
      const category = categories.get(product.category);
      if (!category) throw new Error(`Missing category for ${product.slug}`);

      const record = await tx.product.upsert({
        where: { slug: product.slug },
        update: {
          name: product.name,
          description: product.description,
          material: product.material,
          dimensions: product.dimensions,
          care: product.care,
          categoryId: category.id,
        },
        create: {
          name: product.name,
          slug: product.slug,
          description: product.description,
          material: product.material,
          dimensions: product.dimensions,
          care: product.care,
          categoryId: category.id,
          status: ProductStatus.PUBLISHED,
        },
        select: { id: true },
      });

      const colors = product.colors.length ? product.colors : ['Standard'];
      const baseStock = Math.floor(product.stock / colors.length);
      const remainder = product.stock % colors.length;

      for (const [index, color] of colors.entries()) {
        const sku = `${product.slug.toUpperCase().replace(/-/g, '_')}-${index + 1}`;
        await tx.productVariant.upsert({
          where: { sku },
          update: {
            name: color,
            pricePaise: product.price * 100,
            compareAtPaise: product.compareAt ? product.compareAt * 100 : null,
            productId: record.id,
          },
          create: {
            productId: record.id,
            name: color,
            sku,
            pricePaise: product.price * 100,
            compareAtPaise: product.compareAt ? product.compareAt * 100 : null,
            stockOnHand: baseStock + (index < remainder ? 1 : 0),
          },
        });
      }

      const existingImage = await tx.productImage.findFirst({
        where: { productId: record.id, sortOrder: 0 },
      });
      if (existingImage) {
        await tx.productImage.update({
          where: { id: existingImage.id },
          data: {
            url: '/nivara-editorial.png',
            altText: product.name,
            sortOrder: 0,
          },
        });
      } else {
        await tx.productImage.create({
          data: {
            productId: record.id,
            url: '/nivara-editorial.png',
            altText: product.name,
            sortOrder: 0,
          },
        });
      }
    }

    console.log(
      `Seeded ${products.length} products across ${categories.size} categories.`,
    );
  });
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
