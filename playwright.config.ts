import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // reducedMotion: axe must not sample colours mid-transition after a colour-scheme switch (flaky contrast failures in CI).
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'on-first-retry', reducedMotion: 'reduce' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI },
});
