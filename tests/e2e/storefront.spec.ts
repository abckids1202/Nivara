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

test('header search opens an accessible live-search form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search the collection' }).click();
  await expect(page.getByPlaceholder('Search products, rooms, materials')).toBeVisible();
  await expect(page.getByRole('search')).toBeVisible();
});

test('primary controls are keyboard focusable', async ({ page }, testInfo) => {
  await page.goto('/');
  const searchButton = page.getByRole('button', { name: 'Search the collection' });
  await searchButton.focus();
  await expect(searchButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('search')).toBeVisible();

  if (testInfo.project.name === 'mobile') {
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await menuButton.focus();
    await expect(menuButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  }
});

test('empty checkout does not claim a payment succeeded', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByText(/Payment is being verified/i)).toHaveCount(0);
});

test('password reset page explains how to request an expired link', async ({
  page,
}) => {
  await page.goto('/account/reset-password');
  await expect(
    page.getByRole('heading', { name: 'Choose a new password' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'account page' }),
  ).toBeVisible();
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
