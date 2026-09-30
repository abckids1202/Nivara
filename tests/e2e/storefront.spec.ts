import { expect, test } from '@playwright/test';

test('homepage exposes the main shopping journey', async ({
  page,
}, testInfo) => {
  await page.goto('/');
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

test('header search opens an accessible live-search form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search the collection' }).click();
  await expect(page.getByPlaceholder('Search products, rooms, materials')).toBeVisible();
  await expect(page.getByRole('search')).toBeVisible();
});

test('empty checkout does not claim a payment succeeded', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByText(/Payment is being verified/i)).toHaveCount(0);
});
