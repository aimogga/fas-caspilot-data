import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { NeedScoreRecompute } from './recompute';

type Call = { table: string; op: 'select' | 'upsert' | 'delete'; filters: unknown[][]; rows?: unknown; opts?: unknown };

/** Chainable stand-in for the supabase-js query builder; records each call and resolves like PostgREST. */
function fake(tables: Record<string, unknown[]>, fail?: string) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    const q = {
      select: () => q,
      in: (...a: unknown[]) => { call.filters.push(['in', ...a]); return q; },
      eq: (...a: unknown[]) => { call.filters.push(['eq', ...a]); return q; },
      not: (...a: unknown[]) => { call.filters.push(['not', ...a]); return q; },
      upsert: (rows: unknown, opts: unknown) => { Object.assign(call, { op: 'upsert', rows, opts }); return q; },
      delete: () => { call.op = 'delete'; return q; },
      then: (resolve: (v: unknown) => unknown) => {
        calls.push(call);
        const error = fail === `${table}:${call.op}` ? { message: `${table} ${call.op} failed` } : null;
        return Promise.resolve({ data: call.op === 'select' ? tables[table] ?? [] : null, error }).then(resolve);
      },
    };
    return q;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

const cfg = (version: string, weights: object, created_at: string, approved_by: string | null) => ({ version, weights, created_at, approved_by });
const ind = (indicator_code: string, geo_fips: string, value: number | null) => ({ indicator_code, geo_fips, value, vintage: '2024', source_id: 's', ingest_run_id: 'r' });
const tables = {
  need_score_config: [cfg('old', { poverty_rate: 1 }, '2026-10-01', 'u'), cfg('v1', { poverty_rate: 0.5, uninsured: 0.5 }, '2026-10-13', 'u'), cfg('draft', { poverty_rate: 1 }, '2026-10-14', null)],
  public_indicator: [ind('poverty_rate', '49001', 10), ind('poverty_rate', '49003', 30), ind('poverty_rate', '49005', 20), ind('uninsured_rate', '49001', 2), ind('uninsured_rate', '49003', 6)],
};

describe('NeedScoreRecompute.run', () => {
  it('scores the newest approved version, upserts by version and county, and removes stale counties', async () => {
    const { client, calls } = fake(tables);
    expect(await NeedScoreRecompute.run(client)).toEqual({ version: 'v1', scored: 2 });
    const read = calls.find((c) => c.table === 'public_indicator');
    expect(read?.filters).toEqual([['in', 'indicator_code', ['poverty_rate', 'uninsured_rate']]]);
    const up = calls.find((c) => c.op === 'upsert');
    expect(up?.opts).toEqual({ onConflict: 'version,geo_fips' });
    // Poverty stats include 49005 (10, 20, 30: mean 20, sd 8.165); it has no uninsured value, so it gets no score.
    // 49001 = 0.5 * (-1.224745) + 0.5 * (-1); 49003 = 0.5 * 1.224745 + 0.5 * 1.
    expect(up?.rows).toEqual([
      expect.objectContaining({ version: 'v1', geo_fips: '49001', score: expect.closeTo(-1.112372, 5) }),
      expect.objectContaining({ version: 'v1', geo_fips: '49003', score: expect.closeTo(1.112372, 5) }),
    ]);
    expect(calls.find((c) => c.op === 'delete')?.filters).toEqual([['eq', 'version', 'v1'], ['not', 'geo_fips', 'in', '(49001,49003)']]);
  });

  it('writes nothing when no version is approved', async () => {
    const { client, calls } = fake({ need_score_config: [cfg('draft', { poverty_rate: 1 }, '2026-10-14', null)] });
    expect(await NeedScoreRecompute.run(client)).toEqual({ version: null, scored: 0 });
    expect(calls.map((c) => c.op)).toEqual(['select']);
  });

  it('throws, without touching existing scores, when no county has every input or weights are invalid', async () => {
    const empty = fake({ ...tables, public_indicator: [] });
    await expect(NeedScoreRecompute.run(empty.client)).rejects.toThrow('no county has every input');
    expect(empty.calls.some((c) => c.op !== 'select')).toBe(false);
    const bad = fake({ ...tables, need_score_config: [cfg('v9', { poverty_rate: 50, uninsured: 50 }, '2026-10-13', 'u')] });
    await expect(NeedScoreRecompute.run(bad.client)).rejects.toThrow('sum to 1');
  });

  it('surfaces database errors from each step', async () => {
    for (const step of ['need_score_config:select', 'public_indicator:select', 'need_score:upsert', 'need_score:delete']) {
      await expect(NeedScoreRecompute.run(fake(tables, step).client)).rejects.toThrow(`${step.replace(':', ' ')} failed`);
    }
  });
});
