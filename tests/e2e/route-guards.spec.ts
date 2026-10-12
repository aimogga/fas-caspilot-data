import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', 'testpass123');
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 }),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);
}

test('a signed-in user on an unknown path gets 404', async ({ page }) => {
  await signIn(page, 'staff@example.test');
  const unknown = await page.goto('/administrator');
  expect(unknown?.status()).toBe(404);
  await expect(page).toHaveURL(/\/administrator$/);
  const missing = await page.goto('/no-such-page');
  expect(missing?.status()).toBe(404);
  await expect(page).toHaveURL(/\/no-such-page$/);
});

test('the wrong role on a guarded prefix gets 403', async ({ page }) => {
  await signIn(page, 'board@example.test');
  const staffHome = await page.goto('/staff');
  expect(staffHome?.status()).toBe(403);
  await expect(page).toHaveURL(/\/staff$/);
  const nestedAdmin = await page.goto('/admin/users');
  expect(nestedAdmin?.status()).toBe(403);
  await expect(page).toHaveURL(/\/admin\/users$/);
});

test('a signed-out user on a guarded prefix goes to login', async ({ page }) => {
  const staffProbe = await page.request.get('/staff', { maxRedirects: 0 });
  expect(staffProbe.status()).toBe(307);
  expect(staffProbe.headers().location).toMatch(/\/login\?redirect=%2Fstaff$/);
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/login\?redirect=%2Fstaff$/);
  const nestedProbe = await page.request.get('/admin/users', { maxRedirects: 0 });
  expect(nestedProbe.status()).toBe(307);
  expect(nestedProbe.headers().location).toMatch(/\/login\?redirect=%2Fadmin%2Fusers$/);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/login\?redirect=%2Fadmin%2Fusers$/);
});
