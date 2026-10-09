import { test, expect, type Page } from '@playwright/test';

async function mockSession(page: Page, role: 'admin' | 'staff' | 'board_viewer' | null) {
  if (role === null) {
    await page.evaluate(() => localStorage.clear());
    return;
  }
  await page.addInitScript((session) => {
    localStorage.setItem(`sb-${window.location.hostname.split('.')[0]}-auth-token`, JSON.stringify(session));
  }, { access_token: 'mock', user: { id: 'test', email: `${role}@test.com`, app_metadata: { role } } });
}

test.describe('auth-roles', () => {
  test('unauthenticated redirects to login', async ({ page }) => {
    await mockSession(page, null);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
  const roleTests: Array<[string, string[], string[]]> = [
    ['admin', ['/', '/staff', '/admin', '/board'], []],
    ['staff', ['/', '/staff', '/board'], ['/admin']],
    ['board_viewer', ['/', '/board'], ['/staff', '/admin']],
  ];
  for (const [role, allowed, denied] of roleTests) {
    test(`${role} access`, async ({ page }) => {
      await mockSession(page, role as 'admin' | 'staff' | 'board_viewer');
      for (const route of allowed) {
        await page.goto(route);
        await expect(page.locator('h1')).not.toContainText('403');
      }
      for (const route of denied) {
        await page.goto(route);
        await expect(page.locator('h1')).toContainText('403');
      }
    });
  }
});
