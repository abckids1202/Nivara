import { PrismaClient, ProductStatus } from "@prisma/client";
import { products } from "../lib/demo-data.ts";

const prisma = new PrismaClient();

const slugify = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function seed() {
  const categoryNames = [...new Set(products.map((product) => product.category))];
  const categories = new Map<string, { id: string }>();

  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
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

    const record = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        description: product.description,
        material: product.material,
        dimensions: product.dimensions,
        care: product.care,
        categoryId: category.id,
        status: ProductStatus.PUBLISHED,
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

    const colors = product.colors.length ? product.colors : ["Standard"];
    const baseStock = Math.floor(product.stock / colors.length);
    const remainder = product.stock % colors.length;

    for (const [index, color] of colors.entries()) {
      const sku = `${product.slug.toUpperCase().replace(/-/g, "_")}-${index + 1}`;
      await prisma.productVariant.upsert({
        where: { sku },
        update: {
          name: color,
          pricePaise: product.price * 100,
          compareAtPaise: product.compareAt ? product.compareAt * 100 : null,
          stockOnHand: baseStock + (index < remainder ? 1 : 0),
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

    const existingImage = await prisma.productImage.findFirst({ where: { productId: record.id, sortOrder: 0 } });
    if (existingImage) {
      await prisma.productImage.update({
        where: { id: existingImage.id },
        data: { url: "/nivara-editorial.png", altText: product.name, sortOrder: 0 },
      });
    } else {
      await prisma.productImage.create({
        data: { productId: record.id, url: "/nivara-editorial.png", altText: product.name, sortOrder: 0 },
      });
    }
  }

  console.log(`Seeded ${products.length} products across ${categories.size} categories.`);
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
