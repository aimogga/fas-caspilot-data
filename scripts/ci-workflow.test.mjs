import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

const yml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

describe('ci.yml', () => {
  it('triggers on pull_request and push to main', () => {
    expect(yml).toMatch(/pull_request:/);
    expect(yml).toMatch(/push:/);
    expect(yml).toMatch(/branches:\s*\[main\]/);
  });
  it('has required job names ci and secret-scan', () => {
    expect(yml).toMatch(/^ {2}ci:/m);
    expect(yml).toMatch(/^ {2}secret-scan:/m);
  });
  it('runs lint, typecheck, unit, db and e2e', () => {
    expect(yml).toContain('pnpm lint');
    expect(yml).toContain('pnpm typecheck');
    expect(yml).toContain('pnpm test');
    expect(yml).toContain('pnpm test:db');
    expect(yml).toContain('pnpm test:e2e');
  });
  it('enables secret scanning that fails closed', () => {
    expect(yml).toContain('--secrets-only');
    expect(yml).toContain('scripts/nightly-audit.mjs');
  });
  it('permissions contents read, concurrency, timeouts', () => {
    expect(yml).toMatch(/contents:\s*read/);
    expect(yml).toContain('concurrency:');
    expect(yml).toContain('cancel-in-progress: true');
    expect(yml).toMatch(/timeout-minutes:/);
  });
  it('starts local Supabase and Playwright chromium', () => {
    expect(yml).toContain('supabase/setup-cli');
    expect(yml).toContain('2.120.0');
    expect(yml).toContain('supabase start');
    expect(yml).toContain('playwright install --with-deps chromium');
    expect(yml).toContain('supabase status -o env');
  });
});
