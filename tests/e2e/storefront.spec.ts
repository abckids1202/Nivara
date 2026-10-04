import { expect, test } from '@playwright/test';

test('homepage exposes the main shopping journey', async ({
  page,
}, testInfo) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['referrer-policy']).toBe(
    'strict-origin-when-cross-origin',
  );
  expect(response?.headers()['permissions-policy']).toBe(
    'camera=(), microphone=(), geolocation=()',
  );
  expect(response?.headers()['x-permitted-cross-domain-policies']).toBe('none');
  expect(response?.headers()['cross-origin-opener-policy']).toBe(
    'same-origin-allow-popups',
  );
  await expect(page).toHaveTitle(/Nivara/);
  await expect(page.getByRole('link', { name: 'Nivara home' })).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  } else {
    await expect(
      page.getByRole('link', { name: 'Shop', exact: true }).first(),
    ).toBeVisible();
  }
  await expect(
    page.getByRole('heading', { name: /Make space for everyday/i }),
  ).toBeVisible();
});

test('catalogue filters remain represented in the URL', async ({ page }) => {
  await page.goto('/shop');
  const search = page.getByPlaceholder('Search the collection');
  await search.fill('desk');
  await expect(page).toHaveURL(/q=desk/);
  await page.getByLabel('Availability').selectOption('available');
  await expect(page).toHaveURL(/availability=available/);
});

test('product-card wishlist prompts unauthenticated shoppers to sign in', async ({
  page,
}) => {
  await page.route('**/api/catalogue**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'product-1',
            name: 'Arc desk organizer',
            slug: 'arc-desk-organizer',
            category: { name: 'Desk & study', slug: 'desk-study' },
            image: null,
            variants: [
              {
                id: 'variant-1',
                pricePaise: 64900,
                compareAtPaise: null,
                stockOnHand: 5,
                stockReserved: 0,
              },
            ],
            minPricePaise: 64900,
            stockAvailable: true,
          },
        ],
        page: 1,
        pageSize: 4,
        total: 1,
        pages: 1,
      }),
    }),
  );
  await page.route('**/api/categories', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route('**/api/wishlist', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Sign in required.' }),
    }),
  );

  await page.goto('/');
  const saveButton = page.getByRole('button', {
    name: 'Save Arc desk organizer to wishlist',
  });
  await expect(saveButton).toBeVisible();
  await saveButton.click();
  await expect(
    page.getByText('Sign in to save pieces to your wishlist.', { exact: true }),
  ).toBeVisible();
});

test('product page reflects an existing wishlist item', async ({ page }) => {
  await page.route('**/api/products/arc-desk-organizer', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'product-1',
          name: 'Arc desk organizer',
          description: 'A calm place for everyday desk essentials.',
          material: 'Powder-coated steel',
          dimensions: '32 × 12 × 8 cm',
          care: 'Wipe clean with a soft cloth.',
          category: { name: 'Desk & study' },
          images: [],
          variants: [
            {
              id: 'variant-1',
              name: 'Single',
              pricePaise: 64900,
              compareAtPaise: null,
              stockOnHand: 5,
              stockReserved: 0,
            },
          ],
          rating: null,
          reviewCount: 0,
          reviews: [],
        },
      }),
    }),
  );
  await page.route('**/api/wishlist', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ productId: 'product-1' }] }),
    }),
  );

  await page.goto('/product/arc-desk-organizer');
  await expect(
    page.getByRole('button', { name: 'Remove from wishlist' }),
  ).toBeVisible({ timeout: 10_000 });
});

test('header search opens an accessible live-search form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search the collection' }).click();
  await expect(
    page.getByRole('combobox', { name: 'Search products' }),
  ).toHaveAttribute('aria-autocomplete', 'list');
  await expect(
    page.getByPlaceholder('Search products, rooms, materials'),
  ).toBeVisible();
  await expect(page.getByRole('search')).toBeVisible();
});

test('support form recovers from a network failure', async ({ page }) => {
  await page.route('**/api/support', (route) => route.abort());
  await page.goto('/support');
  await page.getByLabel('Name').fill('Test customer');
  await page.getByLabel('Email').fill('customer@example.com');
  await page.getByLabel('Message').fill('I need help with a recent order.');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'could not reach support' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Send feedback' }),
  ).toBeEnabled();
});

test('primary controls are keyboard focusable', async ({ page }, testInfo) => {
  await page.goto('/');
  const searchButton = page.getByRole('button', {
    name: 'Search the collection',
  });
  await searchButton.focus();
  await expect(searchButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('search')).toBeVisible();

  if (testInfo.project.name === 'mobile') {
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await menuButton.focus();
    await expect(menuButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeVisible();
  }
});

test('empty checkout does not claim a payment succeeded', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByText(/Payment is being verified/i)).toHaveCount(0);
});

test('checkout keeps a payment failure visible after hosted checkout closes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Razorpay = class {
      private readonly handlers = new Map<string, (value: unknown) => void>();

      constructor(_options: unknown) {}

      on(name: string, handler: (value: unknown) => void) {
        this.handlers.set(name, handler);
      }

      open() {
        this.handlers.get('payment.failed')?.({
          error: { description: 'Test payment was declined.' },
        });
      }
    } as never;
  });
  await page.route('**/api/cart', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'cart-item-1',
            quantity: 1,
            variantId: 'variant-1',
            variant: {
              name: 'Single',
              sku: 'NIV-1',
              pricePaise: 64900,
              stockOnHand: 5,
              stockReserved: 0,
              product: { name: 'Arc desk organizer', slug: 'arc-desk-organizer' },
            },
          },
        ],
      }),
    }),
  );
  await page.route('**/api/checkout', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orderNumber: 'NV-TEST-1',
        razorpayOrderId: 'order_test_1',
        keyId: 'fixture-payment-key',
        amountPaise: 72800,
        currency: 'INR',
        guestAccessToken: 'guest-test-token',
      }),
    }),
  );
  await page.route('**/api/guest-orders/guest-test-token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orderNumber: 'NV-TEST-1',
        paymentStatus: 'FAILED',
        fulfilmentStatus: 'PROCESSING',
        totalPaise: 72800,
        items: [],
        shipment: null,
      }),
    }),
  );

  await page.goto('/checkout');
  await page.getByLabel('Email').fill('customer@example.com');
  await page.getByLabel('Full name').fill('Test customer');
  await page.getByLabel('Address').fill('1 Test Street');
  await page.getByLabel('City').fill('Delhi');
  await page.getByLabel('State').fill('Delhi');
  await page.getByLabel('PIN code').fill('110001');
  await page.getByRole('button', { name: /Continue to Razorpay/ }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Test payment was declined' }),
  ).toBeVisible();
});

test('guest order page exposes only scoped order details and retry action', async ({
  page,
}) => {
  await page.route('**/api/cart', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route('**/api/guest-orders/access-token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orderNumber: 'NV-1001',
        paymentStatus: 'FAILED',
        fulfilmentStatus: 'PROCESSING',
        totalPaise: 72800,
        items: [
          {
            id: 'order-item-1',
            productName: 'Arc desk organizer',
            variantName: 'Single',
            unitPricePaise: 64900,
            quantity: 1,
          },
        ],
        shipment: null,
      }),
    }),
  );

  await page.goto('/guest-order/access-token');
  await expect(page.getByRole('heading', { name: 'NV-1001' })).toBeVisible();
  await expect(page.getByText('Arc desk organizer')).toBeVisible();
  await expect(
    page.getByText(/private link expires after seven days/i),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry payment' })).toBeVisible();
});

test('password reset page explains how to request an expired link', async ({
  page,
}) => {
  await page.goto('/account/reset-password');
  await expect(
    page.getByRole('heading', { name: 'Choose a new password' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'account page' })).toBeVisible();
});

test('account dashboard exposes recovery when an account request fails', async ({
  page,
}) => {
  await page.route('**/api/account/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { email: 'customer@example.com' } }),
    }),
  );
  await page.route('**/api/account/orders', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Orders are temporarily unavailable.' }),
    }),
  );
  await page.route('**/api/account/addresses', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route('**/api/wishlist', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );

  await page.goto('/account');
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Some account details could not be loaded.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText('Loading your account details…')).toHaveCount(0);
});

test('offline connection state is announced accessibly', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Search the collection' }),
  ).toBeVisible();
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  const offlineStatuses = page.getByRole('status');
  await expect(offlineStatuses.first()).toContainText(/offline/i);
  await page.context().setOffline(false);
});

test('publishes crawl controls for search engines', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('<loc>https://nivara.example</loc>');
  expect(sitemapText).toContain('<loc>https://nivara.example/shop</loc>');

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  const robotsText = await robots.text();
  expect(robotsText).toContain('Disallow: /admin');
  expect(robotsText).toContain('Disallow: /api/');
  expect(robotsText).toContain('Disallow: /account');
  expect(robotsText).toContain('Disallow: /checkout');
  expect(robotsText).toContain('Disallow: /guest-order/');
  expect(robotsText).toContain('Sitemap: https://nivara.example/sitemap.xml');
});

test('honours reduced-motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const transitionDuration = await page
    .locator('main.page-transition')
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(['0.01ms', '1e-05s']).toContain(transitionDuration);
});
