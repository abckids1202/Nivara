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
    if (url.pathname === '/api/admin/orders')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination }),
      });
    if (url.pathname === '/api/admin/reviews')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination }),
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
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination }),
      });
    return route.continue();
  });

  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Store control.' })).toBeVisible();
  await expect(page.getByText('Published products')).toBeVisible();
  await expect(page.getByText('Arc desk organizer')).toBeVisible();
  await expect(page.getByText('Paid-order performance.')).toBeVisible();
  await expect(page.getByText('Orders that need attention.')).toBeVisible();
});
