import { expect, test } from '@playwright/test';

const pagination = { page: 1, pageSize: 24, total: 0, totalPages: 1 };

test('admin dashboard exposes server authorization failures', async ({
  page,
}) => {
  await page.route('**/api/admin/**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Administrator authentication is required.' }),
    }),
  );

  await page.goto('/admin');

  await expect(
    page.getByRole('alert').filter({
      hasText: 'Administrator authentication is required to manage the store.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('authorized admin dashboard renders operational sections', async ({
  page,
}) => {
  page.on('dialog', async (dialog) => {
    await dialog.accept(dialog.defaultValue() || 'Approved after moderation');
  });
  await page.route('**/api/admin/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/admin/products') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'product-1',
              name: 'Arc desk organizer',
              slug: 'arc-desk-organizer',
              status: 'PUBLISHED',
              category: { name: 'Desk' },
              images: [],
              variants: [
                {
                  id: 'variant-1',
                  name: 'Single',
                  sku: 'ARC-1',
                  pricePaise: 64900,
                  stockOnHand: 12,
                  stockReserved: 0,
                },
              ],
            },
          ],
          pagination: { ...pagination, total: 1 },
        }),
      });
    }
    if (url.pathname === '/api/admin/orders' && route.request().method() === 'PATCH')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'order-1' } }),
      });
    if (url.pathname === '/api/admin/orders')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'order-1',
              orderNumber: 'NV-ADMIN-1',
              guestEmail: 'customer@example.com',
              paymentStatus: 'PAID',
              fulfilmentStatus: 'PROCESSING',
              totalPaise: 72800,
              items: [{ productName: 'Arc desk organizer', quantity: 1 }],
              shipment: null,
            },
          ],
          pagination: { ...pagination, total: 1 },
        }),
      });
    if (url.pathname === '/api/admin/reviews' && route.request().method() === 'PATCH')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'review-1', status: 'APPROVED' } }),
      });
    if (url.pathname === '/api/admin/reviews')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'review-1',
              displayName: 'Customer',
              rating: 5,
              body: 'This organizer feels excellent in my workspace.',
              product: { name: 'Arc desk organizer' },
            },
          ],
          pagination: { ...pagination, total: 1 },
        }),
      });
    if (url.pathname === '/api/admin/categories')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    if (url.pathname === '/api/admin/reports')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            paidOrderCount: 0,
            paidOrderTotalPaise: 0,
            paymentReviewCount: 0,
            lowStock: [],
            adjustments: [],
          },
        }),
      });
    if (url.pathname === '/api/admin/orders/payment-review')
      if (route.request().method() === 'PATCH')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { id: 'payment-order-1' } }),
        });
    if (url.pathname === '/api/admin/orders/payment-review')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'payment-order-1',
              orderNumber: 'NV-PAY-1',
              guestEmail: 'customer@example.com',
              paymentStatus: 'PAYMENT_REVIEW',
              totalPaise: 72800,
              items: [{ productName: 'Arc desk organizer', quantity: 1 }],
              payments: [{ providerPaymentId: 'pay_test_1' }],
              paymentReviewResolution: null,
            },
          ],
          pagination: { ...pagination, total: 1 },
        }),
      });
    return route.continue();
  });

  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Store control.' })).toBeVisible();
  await expect(page.getByText('Published products')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Arc desk organizer' }),
  ).toBeVisible();
  await expect(page.getByText('Paid-order performance.')).toBeVisible();
  await expect(page.getByText('Orders that need attention.')).toBeVisible();
  await expect(page.getByText('NV-ADMIN-1')).toBeVisible();
  await expect(page.getByText('Review queue.')).toBeVisible();

  await page
    .getByLabel('Fulfilment status for NV-ADMIN-1')
    .selectOption('SHIPPED');
  await page.getByLabel('Courier').fill('Nivara Express');
  await page.getByLabel('Tracking reference').fill('TRACK-123');
  await page.getByRole('button', { name: 'Save status' }).click();
  await expect(page.getByText('NV-ADMIN-1 updated.')).toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Review approved.')).toBeVisible();

  await page.getByRole('button', { name: 'Record refund' }).click();
  await expect(page.getByText('NV-PAY-1 resolved.')).toBeVisible();
});
