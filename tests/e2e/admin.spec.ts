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
      if (route.request().method() === 'POST')
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'product-2',
              name: 'Linen catchall tray',
              slug: 'linen-catchall-tray',
              status: 'DRAFT',
            },
          }),
        });
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
    if (
      url.pathname === '/api/admin/products/product-1' &&
      ['PATCH', 'DELETE'].includes(route.request().method())
    )
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'product-1' } }),
      });
    if (
      url.pathname ===
        '/api/admin/products/product-1/variants/variant-1' &&
      route.request().method() === 'PATCH'
    )
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'variant-1',
            name: 'Single',
            sku: 'ARC-UPDATED',
            pricePaise: 69900,
          },
        }),
      });
    if (
      url.pathname === '/api/admin/products/product-1/variants' &&
      route.request().method() === 'POST'
    )
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'variant-2',
            name: 'Standard',
            sku: 'NIV-NEW-VARIANT',
            pricePaise: 0,
            stockOnHand: 0,
            stockReserved: 0,
          },
        }),
      });
    if (
      url.pathname === '/api/admin/products/product-1/images' &&
      route.request().method() === 'POST'
    )
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'image-1',
            url: '/uploaded-image.webp',
            altText: 'Arc organizer on a desk',
          },
        }),
      });
    if (
      url.pathname === '/api/admin/inventory' &&
      route.request().method() === 'POST'
    )
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'adjustment-1',
            quantityDelta: 3,
            reason: 'Admin catalogue adjustment',
          },
        }),
      });
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
    if (
      url.pathname === '/api/admin/categories' &&
      route.request().method() === 'POST'
    )
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'category-2', name: 'Living room', slug: 'living-room' },
        }),
      });
    if (
      url.pathname === '/api/admin/categories/category-1' &&
      route.request().method() === 'PATCH'
    )
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'category-1', name: 'Workspace', slug: 'workspace' },
        }),
      });
    if (url.pathname === '/api/admin/categories')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'category-1',
              name: 'Desk',
              slug: 'desk',
              _count: { products: 1 },
            },
          ],
        }),
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

  const productsResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/admin/products' &&
      response.ok(),
  );
  await page.goto('/admin');
  await productsResponse;

  await expect(page.getByRole('heading', { name: 'Store control.' })).toBeVisible();
  await expect(page.getByText('Published products')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Arc desk organizer' }),
  ).toBeVisible();
  await expect(page.getByText('Paid-order performance.')).toBeVisible();
  await expect(page.getByText('Orders that need attention.')).toBeVisible();
  await expect(page.getByText('NV-ADMIN-1')).toBeVisible();
  await expect(page.getByText('Review queue.')).toBeVisible();

  await page.getByRole('button', { name: 'New product' }).click();
  await page.getByLabel('Product name').fill('Linen catchall tray');
  await page.getByLabel('Product slug').fill('linen-catchall-tray');
  await page.getByLabel('Product category').selectOption('category-1');
  await page
    .getByLabel('Product description')
    .fill('A considered tray for everyday objects and small rituals.');
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(
    page.getByText('Product created. Add a variant before publishing.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'New category' }).click();
  await page.getByLabel('Category name').fill('Living room');
  await page.getByLabel('Category slug').fill('living-room');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Category created.')).toBeVisible();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Category name').fill('Workspace');
  await page.getByLabel('Category slug').fill('workspace');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Category updated.')).toBeVisible();

  await page.getByRole('button', { name: 'View variants' }).click();
  await page.getByRole('button', { name: 'Add variant' }).click();
  await expect(page.getByText('Variant created. Update its price and SKU.')).toBeVisible();
  await page.getByLabel('SKU for Single').fill('ARC-UPDATED');
  await page.getByLabel('Price for Single').fill('699');
  await page.getByRole('button', { name: 'Save variant' }).click();
  await expect(page.getByText('Variant updated.')).toBeVisible();

  await page
    .getByLabel('Image file for Arc desk organizer')
    .setInputFiles({
      name: 'arc-organizer.webp',
      mimeType: 'image/webp',
      buffer: Buffer.from('test image bytes'),
    });
  await page
    .getByLabel('Image alt text for Arc desk organizer')
    .fill('Arc organizer on a desk');
  await page.getByRole('button', { name: 'Upload image' }).click();
  await expect(page.getByText('Product image uploaded.')).toBeVisible();

  await page.getByLabel('Stock adjustment for Single').fill('3');
  await page.getByRole('button', { name: 'Adjust' }).click();
  await expect(page.getByText('Stock adjustment saved and audited.')).toBeVisible();

  await page.getByRole('button', { name: 'Set draft' }).click();
  await expect(
    page.getByText('Arc desk organizer is now draft.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Arc desk organizer was archived.')).toBeVisible();

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
