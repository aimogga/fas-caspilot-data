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

test('staff on /admin gets 403', async ({ page }) => {
  await signIn(page, 'staff@example.test');
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(403);
  await expect(page).toHaveURL(/\/admin$/);
});

test('norole on each guarded prefix gets 403', async ({ page }) => {
  await signIn(page, 'norole@example.test');
  for (const path of ['/admin', '/staff', '/board']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(403);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test('a non-admin on an encoded admin path gets 403', async ({ page }) => {
  await signIn(page, 'staff@example.test');
  const res = await page.request.get('/%61dmin', { maxRedirects: 0 });
  expect(res.status()).toBe(403);
});

test('a role on its own encoded prefix gets 200', async ({ page }) => {
  const cases = [
    ['staff@example.test', '/%73taff'],
    ['board@example.test', '/%62oard'],
    ['admin@example.test', '/%61dmin'],
  ] as const;
  for (const [email, encoded] of cases) {
    await page.context().clearCookies();
    await signIn(page, email);
    const res = await page.request.get(encoded, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  }
});

test('backslash paths get 400 and encoded unicode does not loop', async ({ page }) => {
  await signIn(page, 'staff@example.test');
  for (const path of ['/%5C%5Cevil.com', '/%2F%5Cevil.com', '/%5Cevil.com', '/%5C/evil.com']) {
    const res = await page.request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(400);
    expect(res.headers().location ?? '').not.toMatch(/evil\.com/);
  }
  const slash = await page.request.get('/%2F%2Fevil.com', { maxRedirects: 0 });
  expect(slash.status()).toBe(404);
  expect(slash.headers().location ?? '').not.toMatch(/^https?:\/\/evil/);
  for (const path of ['/a%20b', '/caf%C3%A9']) {
    const res = await page.request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  }
});

test('norole is default-denied on an unknown path', async ({ page }) => {
  await signIn(page, 'norole@example.test');
  const response = await page.goto('/administrator');
  expect(response?.status()).toBe(403);
  await expect(page).toHaveURL(/\/administrator$/);
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
