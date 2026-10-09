import { test, expect, type Page } from '@playwright/test';

async function mockSupabaseSession(page: Page, role: 'admin' | 'staff' | 'board_viewer' | null) {
  if (role === null) {
    await page.evaluate(() => {
      localStorage.clear();
      document.cookie.split(';').forEach((c) => {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
    });
    return;
  }

  const mockUser = {
    id: 'test-user-id',
    email: `${role}@test.com`,
    app_metadata: { role },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  };

  const mockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: mockUser,
  };

  await page.addInitScript((session) => {
    const storageKey = `sb-${window.location.hostname.split('.')[0]}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, mockSession);
}

test.describe('Authentication and Role-based Access', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await mockSupabaseSession(page, null);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user trying to access staff page is redirected to login', async ({ page }) => {
    await mockSupabaseSession(page, null);
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin can access all pages', async ({ page }) => {
    await mockSupabaseSession(page, 'admin');
    
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Home');
    
    await page.goto('/staff');
    await expect(page.locator('h1')).toContainText('Staff');
    
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText('Admin');
    
    await page.goto('/board');
    await expect(page.locator('h1')).toContainText('Board');
  });

  test('staff can access home, staff, and board but not admin', async ({ page }) => {
    await mockSupabaseSession(page, 'staff');
    
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Home');
    
    await page.goto('/staff');
    await expect(page.locator('h1')).toContainText('Staff');
    
    await page.goto('/board');
    await expect(page.locator('h1')).toContainText('Board');
    
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText('403');
  });

  test('board_viewer can access home and board but not staff or admin', async ({ page }) => {
    await mockSupabaseSession(page, 'board_viewer');
    
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Home');
    
    await page.goto('/board');
    await expect(page.locator('h1')).toContainText('Board');
    
    await page.goto('/staff');
    await expect(page.locator('h1')).toContainText('403');
    
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText('403');
  });

  test('login page is accessible without authentication', async ({ page }) => {
    await mockSupabaseSession(page, null);
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Sign In');
  });
});
