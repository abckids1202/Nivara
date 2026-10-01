export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  description: string;
  material: string;
  dimensions: string;
  care: string;
  colors: string[];
  rating: number;
  reviewCount: number;
  stock: number;
  badge?: string;
  imagePosition: string;
};

export const categories = [
  { name: 'Desk & study', count: 28, accent: 'sage' },
  { name: 'Storage', count: 34, accent: 'clay' },
  { name: 'Soft furnishings', count: 26, accent: 'ink' },
  { name: 'Planters', count: 22, accent: 'olive' },
  { name: 'Kitchen', count: 31, accent: 'sand' },
];

export const products: Product[] = [
  {
    id: 'p-001',
    slug: 'arc-desk-organizer',
    name: 'Arc desk organizer',
    category: 'Desk & study',
    price: 649,
    compareAt: 799,
    description:
      'A quiet, modular home for pens, cables, notes, and the small things that make a desk feel like yours.',
    material: 'Powder-coated steel',
    dimensions: '24 × 12 × 9 cm',
    care: 'Wipe clean with a soft, damp cloth.',
    colors: ['Clay', 'Moss', 'Charcoal'],
    rating: 4.8,
    reviewCount: 18,
    stock: 12,
    badge: 'New',
    imagePosition: '28% 52%',
  },
  {
    id: 'p-002',
    slug: 'linen-grid-cushion-cover',
    name: 'Linen grid cushion cover',
    category: 'Soft furnishings',
    price: 549,
    compareAt: 699,
    description:
      'A soft cotton-linen cover with a simple woven grid for sofas, reading corners, and slow Sunday mornings.',
    material: 'Cotton-linen blend',
    dimensions: '45 × 45 cm',
    care: 'Cold wash inside out. Do not bleach.',
    colors: ['Oat', 'Ink', 'Terracotta'],
    rating: 4.7,
    reviewCount: 24,
    stock: 8,
    badge: 'Best seller',
    imagePosition: '68% 64%',
  },
  {
    id: 'p-003',
    slug: 'quiet-terracotta-planter',
    name: 'Quiet terracotta planter',
    category: 'Planters',
    price: 899,
    description:
      'A rounded terracotta planter with a matte finish and drainage tray for shelves, windowsills, and desks.',
    material: 'Terracotta clay',
    dimensions: '18 cm diameter × 16 cm height',
    care: 'Empty excess water from the tray after watering.',
    colors: ['Terracotta', 'Ivory'],
    rating: 4.9,
    reviewCount: 31,
    stock: 4,
    imagePosition: '75% 40%',
  },
  {
    id: 'p-004',
    slug: 'woven-loop-storage-basket',
    name: 'Woven loop storage basket',
    category: 'Storage',
    price: 1199,
    compareAt: 1399,
    description:
      'A flexible woven basket for cables, throws, toys, and all the useful things that deserve a calmer home.',
    material: 'Natural seagrass',
    dimensions: '32 × 24 × 20 cm',
    care: 'Dust gently. Keep away from prolonged moisture.',
    colors: ['Natural', 'Charcoal'],
    rating: 4.6,
    reviewCount: 15,
    stock: 0,
    badge: 'Sold out',
    imagePosition: '48% 45%',
  },
  {
    id: 'p-005',
    slug: 'low-glow-table-lamp',
    name: 'Low glow table lamp',
    category: 'Desk & study',
    price: 1899,
    compareAt: 2199,
    description:
      'A small, warm pool of light for late reading, bedside tables, and making a room feel lived in.',
    material: 'Powder-coated metal and glass',
    dimensions: '16 × 16 × 26 cm',
    care: 'Wipe with a dry microfiber cloth.',
    colors: ['Charcoal', 'Ivory'],
    rating: 4.8,
    reviewCount: 42,
    stock: 6,
    badge: 'Best seller',
    imagePosition: '58% 37%',
  },
  {
    id: 'p-006',
    slug: 'everyday-spice-set',
    name: 'Everyday spice set',
    category: 'Kitchen',
    price: 749,
    description:
      'Four labelled glass jars with a compact tray for making everyday cooking easier to reach.',
    material: 'Glass, bamboo, and steel',
    dimensions: '28 × 8 × 12 cm',
    care: 'Hand wash jars. Keep tray dry.',
    colors: ['Bamboo', 'Charcoal'],
    rating: 4.5,
    reviewCount: 12,
    stock: 18,
    imagePosition: '82% 52%',
  },
  {
    id: 'p-007',
    slug: 'soft-edge-catchall',
    name: 'Soft-edge catchall',
    category: 'Storage',
    price: 399,
    description:
      'A small tray for keys, rings, earbuds, and the things that otherwise disappear by the door.',
    material: 'Glazed ceramic',
    dimensions: '18 × 12 × 3 cm',
    care: 'Hand wash and dry immediately.',
    colors: ['Oat', 'Moss', 'Clay'],
    rating: 4.4,
    reviewCount: 9,
    stock: 23,
    imagePosition: '37% 72%',
  },
  {
    id: 'p-008',
    slug: 'everyday-cotton-runner',
    name: 'Everyday cotton runner',
    category: 'Soft furnishings',
    price: 799,
    compareAt: 999,
    description:
      'A textured cotton runner that adds a little rhythm to a dining table, console, or open shelf.',
    material: 'Handwoven cotton',
    dimensions: '150 × 35 cm',
    care: 'Gentle machine wash. Line dry.',
    colors: ['Oat', 'Ink'],
    rating: 4.7,
    reviewCount: 19,
    stock: 10,
    imagePosition: '20% 80%',
  },
  {
    id: 'p-009',
    slug: 'stacked-bamboo-tray',
    name: 'Stacked bamboo tray',
    category: 'Kitchen',
    price: 999,
    description:
      'A light bamboo tray with raised edges for serving tea, arranging breakfast, or keeping counters tidy.',
    material: 'Bamboo',
    dimensions: '38 × 26 × 5 cm',
    care: 'Wipe clean. Oil occasionally with food-safe oil.',
    colors: ['Bamboo', 'Walnut'],
    rating: 4.6,
    reviewCount: 14,
    stock: 7,
    imagePosition: '70% 78%',
  },
  {
    id: 'p-010',
    slug: 'ribbed-glass-vase',
    name: 'Ribbed glass vase',
    category: 'Planters',
    price: 699,
    description:
      'A ribbed glass vase for a single stem, a small branch, or a little everyday colour on a shelf.',
    material: 'Ribbed glass',
    dimensions: '10 cm diameter × 18 cm height',
    care: 'Hand wash with mild soap.',
    colors: ['Clear', 'Smoke'],
    rating: 4.8,
    reviewCount: 21,
    stock: 9,
    badge: 'New',
    imagePosition: '86% 36%',
  },
  {
    id: 'p-011',
    slug: 'canvas-cable-pouch',
    name: 'Canvas cable pouch',
    category: 'Desk & study',
    price: 449,
    description:
      'A compact zipped pouch for chargers, adapters, and the small collection of cables that travels with you.',
    material: 'Waxed cotton canvas',
    dimensions: '22 × 12 × 5 cm',
    care: 'Spot clean only.',
    colors: ['Olive', 'Ink'],
    rating: 4.5,
    reviewCount: 11,
    stock: 16,
    imagePosition: '12% 45%',
  },
  {
    id: 'p-012',
    slug: 'moss-check-doormat',
    name: 'Moss check doormat',
    category: 'Soft furnishings',
    price: 1299,
    description:
      'A sturdy cotton doormat with a quiet check pattern for the first step inside your home.',
    material: 'Cotton and jute',
    dimensions: '60 × 40 cm',
    care: 'Shake outdoors. Spot clean gently.',
    colors: ['Moss', 'Natural'],
    rating: 4.3,
    reviewCount: 7,
    stock: 5,
    imagePosition: '52% 90%',
  },
];

export const getProduct = (slug: string) =>
  products.find((product) => product.slug === slug) ?? products[0];
