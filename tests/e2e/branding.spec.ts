import { expect, test, type Page } from '@playwright/test';

const CASE_PILOT = /case\s*pilot/i;

async function assertNoCasePilot(page: Page): Promise<void> {
  expect(await page.title(), `title of ${page.url()}`).not.toMatch(CASE_PILOT);
  expect(await page.locator('body').innerText(), `body of ${page.url()}`).not.toMatch(CASE_PILOT);
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', 'admin@example.test');
  await page.fill('#password', 'testpass123');
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 }),
    page.click('button[type="submit"]'),
  ]);
}

test('login page and document title show FAS Grants', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle('FAS Grants');
  await expect(page.getByRole('heading', { name: 'FAS Grants' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Family Advocacy Services');
  await assertNoCasePilot(page);
});

test('rendered app pages show FAS Grants and never CasePilot', async ({ page }) => {
  await signIn(page);
  for (const route of ['/', '/staff', '/admin', '/board']) {
    await page.goto(route);
    await expect(page).toHaveTitle('FAS Grants');
    await expect(page.locator('body')).toContainText('FAS Grants');
    await assertNoCasePilot(page);
  }
  await page.goto('/403');
  await expect(page).toHaveTitle('FAS Grants');
  await assertNoCasePilot(page);
});
