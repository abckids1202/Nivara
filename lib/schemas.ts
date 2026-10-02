import { z } from 'zod';

const indianPostalCode = z
  .string()
  .regex(/^\d{6}$/, 'Enter a valid six-digit PIN code');

export const authCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const passwordResetSchema = z.object({ email: z.string().email() });

export const passwordUpdateSchema = z.object({
  accessToken: z.string().min(20).max(4096),
  refreshToken: z.string().min(20).max(4096).optional(),
  password: z.string().min(8).max(128),
});

export const supportRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  message: z.string().trim().min(10).max(4_000),
});

export const checkoutSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(5).max(240),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: indianPostalCode,
  country: z.literal('IN').default('IN'),
});

export const cartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
});

export const checkoutRequestSchema = checkoutSchema.extend({
  items: z
    .array(cartItemSchema)
    .min(1)
    .max(30)
    .superRefine((items, context) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item.variantId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'variantId'],
            message: 'Each variant may appear only once',
          });
        }
        seen.add(item.variantId);
      });
    }),
});

export const addressSchema = checkoutSchema.omit({ email: true }).extend({
  label: z.string().trim().max(40).optional(),
});

export const productMutationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(10_000),
  material: z.string().trim().max(160).optional(),
  dimensions: z.string().trim().max(160).optional(),
  care: z.string().trim().max(2_000).optional(),
  categoryId: z.string().min(1),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
});

export const inventoryAdjustmentSchema = z.object({
  variantId: z.string().min(1),
  quantityDelta: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(240),
});

export const fulfilmentUpdateSchema = z.object({
  status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED']),
  courierName: z.string().trim().max(120).optional(),
  trackingReference: z.string().trim().max(160).optional(),
});

export const moderationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().min(3).max(500),
});

export const paymentReviewResolutionSchema = z
  .object({
    action: z.enum(['REFUND', 'FULFIL', 'CANCEL']),
    reason: z.string().trim().min(3).max(500),
    refundReference: z.string().trim().max(160).optional(),
  })
  .superRefine((value, context) => {
    if (value.action === 'REFUND' && !value.refundReference?.trim())
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['refundReference'],
        message: 'A provider refund reference is required',
      });
  });

export const catalogueQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, 'Search text is too long')
    .transform((value) => value || undefined)
    .optional(),
  category: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid category')
    .optional(),
  availability: z.enum(['all', 'available', 'soldout']).default('all'),
  sort: z.enum(['newest', 'best', 'price-low', 'price-high']).default('newest'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
  maxPricePaise: z.coerce.number().int().min(1).max(100_000_000).optional(),
});
