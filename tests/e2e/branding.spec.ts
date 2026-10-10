import { expect, test, type Page } from '@playwright/test';

const FORBIDDEN_NAME = /case\s*pilot|fas grants/i;

async function assertNoForbiddenName(page: Page): Promise<void> {
  expect(await page.title(), `title of ${page.url()}`).not.toMatch(FORBIDDEN_NAME);
  expect(await page.locator('body').innerText(), `body of ${page.url()}`).not.toMatch(FORBIDDEN_NAME);
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

test('login page and document title show FAS Evidence', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle('FAS Evidence');
  await expect(page.getByRole('heading', { name: 'FAS Evidence' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Family Advocacy Services');
  await assertNoForbiddenName(page);
});

test('rendered app pages show FAS Evidence and never CasePilot or FAS Grants', async ({ page }) => {
  await signIn(page);
  for (const route of ['/', '/staff', '/admin', '/board']) {
    await page.goto(route);
    await expect(page).toHaveTitle('FAS Evidence');
    await expect(page.locator('body')).toContainText('FAS Evidence');
    await assertNoForbiddenName(page);
  }
  await page.goto('/403');
  await expect(page).toHaveTitle('FAS Evidence');
  await assertNoForbiddenName(page);
});
