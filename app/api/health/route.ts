import { noStore } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { hasConfiguredValue } from '@/lib/configuration';
import { providerFetch } from '@/lib/provider-fetch';

function hasHttpsUrl(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

async function isStorageBucketReachable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (
    !hasConfiguredValue(supabaseUrl, ['your-project']) ||
    !hasConfiguredValue(serviceRoleKey, ['replace-me']) ||
    !hasConfiguredValue(bucket, ['replace-me'])
  )
    return false;

  try {
    const response = await providerFetch(
      `${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: 'no-store',
      },
    );
    const metadata = (await response.json().catch(() => null)) as {
      public?: unknown;
    } | null;
    return response.ok && metadata?.public === true;
  } catch {
    return false;
  }
}

async function isSupabaseAuthReachable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (
    !hasConfiguredValue(supabaseUrl, ['your-project']) ||
    !hasConfiguredValue(anonKey, ['replace-me'])
  )
    return false;

  try {
    const response = await providerFetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  let database = 'not_configured';
  let schemaConfigured = false;
  let inventoryConstraintConfigured = false;
  let catalogueQueryIndexConfigured = false;
  if (process.env.DATABASE_URL) {
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          userTable: string | null;
          addressTable: string | null;
          categoryTable: string | null;
          productTable: string | null;
          variantTable: string | null;
          imageTable: string | null;
          wishlistTable: string | null;
          wishlistItemTable: string | null;
          cartTable: string | null;
          cartItemTable: string | null;
          orderTable: string | null;
          orderItemTable: string | null;
          paymentAttemptTable: string | null;
          paymentEventTable: string | null;
          inventoryTable: string | null;
          reviewTable: string | null;
          shipmentTable: string | null;
          inventoryAdjustmentTable: string | null;
          paymentReviewResolutionTable: string | null;
          moderationActionTable: string | null;
          guestAttemptTable: string | null;
          accessRateTable: string | null;
          auditTable: string | null;
          emailDeliveryTable: string | null;
          cleanupTable: string | null;
          inventoryConstraint: boolean;
          catalogueQueryIndex: boolean;
        }>
      >`
        SELECT
          to_regclass('public."User"') AS "userTable",
          to_regclass('public."Address"') AS "addressTable",
          to_regclass('public."Category"') AS "categoryTable",
          to_regclass('public."Product"') AS "productTable",
          to_regclass('public."ProductVariant"') AS "variantTable",
          to_regclass('public."ProductImage"') AS "imageTable",
          to_regclass('public."Wishlist"') AS "wishlistTable",
          to_regclass('public."WishlistItem"') AS "wishlistItemTable",
          to_regclass('public."Cart"') AS "cartTable",
          to_regclass('public."CartItem"') AS "cartItemTable",
          to_regclass('public."Order"') AS "orderTable",
          to_regclass('public."OrderItem"') AS "orderItemTable",
          to_regclass('public."PaymentAttempt"') AS "paymentAttemptTable",
          to_regclass('public."PaymentEvent"') AS "paymentEventTable",
          to_regclass('public."InventoryReservation"') AS "inventoryTable",
          to_regclass('public."Review"') AS "reviewTable",
          to_regclass('public."Shipment"') AS "shipmentTable",
          to_regclass('public."InventoryAdjustment"') AS "inventoryAdjustmentTable",
          to_regclass('public."PaymentReviewResolution"') AS "paymentReviewResolutionTable",
          to_regclass('public."ModerationAction"') AS "moderationActionTable",
          to_regclass('public."GuestOrderAccessAttempt"') AS "guestAttemptTable",
          to_regclass('public."AccessRateLog"') AS "accessRateTable",
          to_regclass('public."AuditLog"') AS "auditTable",
          to_regclass('public."EmailDelivery"') AS "emailDeliveryTable",
          to_regclass('public."StorageCleanupTask"') AS "cleanupTable",
          EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'ProductVariant_stock_invariants'
              AND conrelid = 'public."ProductVariant"'::regclass
          ) AS "inventoryConstraint",
          to_regclass(
            'public."ProductVariant_productId_stockOnHand_stockReserved_pricePaise_idx"'
          ) IS NOT NULL AS "catalogueQueryIndex"
      `;
      const schema = rows[0];
      schemaConfigured = Boolean(
        schema &&
          Object.entries(schema)
            .filter(
              ([key]) =>
                key !== 'inventoryConstraint' && key !== 'catalogueQueryIndex',
            )
            .every(([, value]) => Boolean(value)),
      );
      inventoryConstraintConfigured = schema?.inventoryConstraint === true;
      catalogueQueryIndexConfigured = schema?.catalogueQueryIndex === true;
      database = schemaConfigured ? 'connected' : 'schema_incomplete';
    } catch {
      database = 'unreachable';
    }
  }
  const paymentsConfigured = Boolean(
    hasConfiguredValue(process.env.RAZORPAY_KEY_ID, ['replace-me']) &&
      hasConfiguredValue(process.env.RAZORPAY_KEY_SECRET, ['replace-me']) &&
      hasConfiguredValue(process.env.RAZORPAY_WEBHOOK_SECRET, ['replace-me']),
  );
  const [authConfigured, storageConfigured] = await Promise.all([
    isSupabaseAuthReachable(),
    isStorageBucketReachable(),
  ]);
  const emailConfigured = Boolean(
    hasConfiguredValue(process.env.RESEND_API_KEY, ['replace-me']) &&
      hasConfiguredValue(process.env.RESEND_FROM_EMAIL, ['example.com']),
  );
  const supportConfigured = Boolean(
    emailConfigured &&
      hasConfiguredValue(process.env.SUPPORT_EMAIL, ['example.com']),
  );
  const cronConfigured = Boolean(
    hasConfiguredValue(process.env.CRON_SECRET, ['replace-me']),
  );
  const deploymentConfigured = Boolean(
    hasConfiguredValue(process.env.DIRECT_URL, ['localhost']) &&
      hasHttpsUrl(process.env.NEXT_PUBLIC_SITE_URL),
  );
  const ready =
    database === 'connected' &&
    schemaConfigured &&
    inventoryConstraintConfigured &&
    catalogueQueryIndexConfigured &&
    deploymentConfigured &&
    authConfigured &&
    paymentsConfigured &&
    storageConfigured &&
    emailConfigured &&
    supportConfigured &&
    cronConfigured;
  const response = {
    service: 'nivara-store',
    status: ready ? 'ok' : 'degraded',
    database,
    schemaConfigured,
    inventoryConstraintConfigured,
    catalogueQueryIndexConfigured,
    deploymentConfigured,
    paymentsConfigured,
    authConfigured,
    storageConfigured,
    emailConfigured,
    supportConfigured,
    cronConfigured,
    ready,
  } as const;
  return noStore(response, ready ? 200 : 503);
}
