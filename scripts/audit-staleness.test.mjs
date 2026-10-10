import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { evaluateStaleness, main, STALE_AFTER_MS } from './audit-staleness.mjs';

const NOW = Date.parse('2026-10-10T12:00:00.000Z');
const FRESH = '2026-10-10T06:00:00.000Z';
const STALE = new Date(NOW - STALE_AFTER_MS - 60_000).toISOString();

function body(runs) {
  return { total_count: runs.length, workflow_runs: runs };
}
function run(over = {}) {
  return {
    event: 'schedule',
    head_branch: 'main',
    conclusion: 'success',
    status: 'completed',
    updated_at: FRESH,
    ...over,
  };
}

describe('evaluateStaleness', () => {
  it('fresh success passes', () => {
    expect(evaluateStaleness(body([run()]), NOW)).toMatchObject({ ok: true });
  });
  it('stale fails', () => {
    expect(evaluateStaleness(body([run({ updated_at: STALE })]), NOW).ok).toBe(false);
  });
  it('no runs fails', () => {
    expect(evaluateStaleness(body([]), NOW).ok).toBe(false);
    expect(evaluateStaleness({ total_count: 0, workflow_runs: [] }, NOW).ok).toBe(false);
  });
  it.each([
    [null],
    [undefined],
    [''],
    ['not json'],
    ['{}'],
    [{ message: 'Bad credentials' }],
    [{ documentation_url: 'https://docs.github.com' }],
    [{ workflow_runs: null }],
    [{ workflow_runs: 'x' }],
    [body([run({ updated_at: 'not-a-date' })])],
  ])('malformed or error %j fails', (payload) => {
    expect(evaluateStaleness(payload, NOW).ok).toBe(false);
  });
  it('only non-schedule or failed runs fails', () => {
    const json = body([
      run({ event: 'workflow_dispatch' }),
      run({ event: 'pull_request' }),
      run({ conclusion: 'failure' }),
      run({ conclusion: 'cancelled', status: 'completed' }),
      run({ head_branch: 'feat' }),
    ]);
    expect(evaluateStaleness(json, NOW).ok).toBe(false);
  });
});

describe('main fail-closed', () => {
  it.each([
    ['API error', { token: 'x', repo: 'o/r', fetch: async () => { throw new Error('net'); } }],
    ['non-200', { token: 'x', repo: 'o/r', fetch: async () => ({ status: 403, text: async () => '{"message":"no"}' }) }],
    ['malformed JSON', { token: 'x', repo: 'o/r', fetch: async () => ({ status: 200, text: async () => 'not json' }) }],
    ['missing token', { token: '', repo: 'o/r', fetch: async () => ({ status: 200, text: async () => '{"workflow_runs":[]}' }) }],
  ])('%s exits non-zero', async (_name, opts) => {
    expect(await main(opts)).not.toBe(0);
  });
});

describe('entry point', () => {
  it('exits non-zero so the alert fires when the latest success is stale', () => {
    const r = spawnSync(process.execPath, ['scripts/audit-staleness.mjs'], {
      env: { ...process.env, AUDIT_STALENESS_FIXTURE: 'stale' },
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/stale/i);
  });
});
