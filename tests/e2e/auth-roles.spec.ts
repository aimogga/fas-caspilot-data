import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', 'testpass123');
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 }),
    page.click('button[type="submit"]'),
  ]);
}

test.describe('auth-roles', () => {
  test('unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
  const cases: Array<[string, string, string[], string[]]> = [
    ['admin', 'admin@example.test', ['/', '/staff', '/admin', '/board'], []],
    ['staff', 'staff@example.test', ['/', '/staff', '/board'], ['/admin']],
    ['board_viewer', 'board@example.test', ['/', '/board'], ['/staff', '/admin']],
  ];
  for (const [role, email, allowed, denied] of cases) {
    test(`${role} access and sign out`, async ({ page }) => {
      await signIn(page, email);
      for (const route of allowed) {
        await page.goto(route);
        await expect(page.locator('h1')).not.toContainText('403');
      }
      for (const route of denied) {
        await page.goto(route);
        await expect(page.locator('h1')).toContainText('403');
      }
      await page.goto('/');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
