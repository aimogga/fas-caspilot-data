import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { evaluateStaleness, main } from './audit-staleness.mjs';

const NOW = Date.parse('2026-10-10T12:00:00.000Z');
const FRESH = '2026-10-10T06:00:00.000Z';

function body(runs) {
  return { total_count: runs.length, workflow_runs: runs };
}
function run(over = {}) {
  return {
    event: 'schedule',
    head_branch: 'main',
    conclusion: 'success',
    status: 'completed',
    created_at: FRESH,
    ...over,
  };
}

describe('evaluateStaleness', () => {
  it('fresh success passes', () => {
    expect(evaluateStaleness(body([run()]), NOW)).toMatchObject({ ok: true });
  });
  it('stale fails', () => {
    expect(evaluateStaleness(body([run({ created_at: '2026-10-08T12:00:00.000Z' })]), NOW).ok).toBe(false);
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
    [body([run({ created_at: 'not-a-date' })])],
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
  it('future-dated created_at more than 5 minutes after now fails', () => {
    expect(evaluateStaleness(body([run({ created_at: '2026-10-10T12:06:00.000Z' })]), Date.parse('2026-10-10T12:00:00.000Z')).ok).toBe(false);
  });
  it('old created_at with a fresh updated_at fails', () => {
    expect(evaluateStaleness(body([run({
      created_at: '2026-10-08T12:00:00.000Z',
      updated_at: '2026-10-10T11:55:00.000Z',
    })]), Date.parse('2026-10-10T12:00:00.000Z')).ok).toBe(false);
  });
  it('23h59m59s old created_at passes', () => {
    expect(evaluateStaleness(body([run({ created_at: '2026-10-09T12:00:01.000Z' })]), Date.parse('2026-10-10T12:00:00.000Z')).ok).toBe(true);
  });
  it('exactly 24h old created_at fails', () => {
    expect(evaluateStaleness(body([run({ created_at: '2026-10-09T12:00:00.000Z' })]), Date.parse('2026-10-10T12:00:00.000Z')).ok).toBe(false);
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
  it('exits 1 when reading the response body throws', async () => {
    const code = await main({
      token: 'x',
      repo: 'o/r',
      fetch: async () => ({ status: 200, text: async () => { throw new Error('read'); } }),
    });
    expect(code).toBe(1);
  });
  it('query URL has event=schedule, branch=main and status=success', async () => {
    let url = '';
    const code = await main({
      token: 'x',
      repo: 'o/r',
      now: NOW,
      fetch: async (u) => {
        url = String(u);
        return { status: 200, text: async () => JSON.stringify(body([run({ created_at: FRESH })])) };
      },
    });
    expect(code).toBe(0);
    expect(url).toMatch(/[?&]event=schedule\b/);
    expect(url).toMatch(/[?&]branch=main\b/);
    expect(url).toMatch(/[?&]status=success\b/);
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
