import { expect, test } from '@playwright/test';

async function authSetCookies(response: { headerValues(name: string): Promise<string[]> }): Promise<string[]> {
  const values = await response.headerValues('set-cookie');
  return values.filter((value) => /sb-.*auth-token/i.test(value));
}

test('login Set-Cookie is HttpOnly and Secure on https', async ({ page, baseURL }) => {
  await page.goto('/login');
  await page.fill('#email', 'staff@example.test');
  await page.fill('#password', 'testpass123');
  const responsePromise = page.waitForResponse((res) => {
    return res.url().includes('/api/auth/login') && res.request().method() === 'POST';
  });
  await page.getByRole('button', { name: 'Sign in' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const setCookies = await authSetCookies(response);
  expect(setCookies.length).toBeGreaterThan(0);
  const https = (baseURL ?? '').startsWith('https:');
  for (const header of setCookies) {
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    if (https) {
      expect(header).toMatch(/Secure/i);
    }
  }
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  const stored = await page.context().cookies();
  const session = stored.filter((cookie) => /sb-.*auth-token/i.test(cookie.name));
  expect(session.length).toBeGreaterThan(0);
  for (const cookie of session) {
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    if (https) {
      expect(cookie.secure).toBe(true);
    }
  }
});
