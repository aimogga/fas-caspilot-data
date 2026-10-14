import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GAP_NO_GRANTEES, ProPublica } from '../../packages/ingest/propublica';
import { FunderHistoryQuery, funderSummary, type StoredFoundationRow } from './funder-history';
const parsed = ProPublica.toAwardHistoryRows(ProPublica.parseOrganization(JSON.parse(readFileSync('tests/fixtures/propublica/organization.json', 'utf8'))));
const rows: StoredFoundationRow[] = parsed.map((r, i) => ({ id: `f${i}`, source: r.source, funder: r.funder, fiscal_year: r.fiscal_year, description: r.description, raw: r.raw }));
describe('unit: funderSummary states data years, latest expenses, band, the grantee gap and a citable source_ref', () => {
  it('summarises stored 990-PF rows newest first, ignoring other sources; empty input says so', () => {
    const s = funderSummary([...rows].reverse().concat({ id: 'u1', source: 'usaspending', funder: 'EXAMPLE FAMILY FOUNDATION', fiscal_year: 2030, description: null, raw: {} }));
    expect(s).toEqual({ funder: 'EXAMPLE FAMILY FOUNDATION', ein: '100000001', years: 3, data_years: [2023, 2022, 2021], latest_year: 2023, latest_expenses: 2500000, capacity_band: 'medium', source_ref: 'award_history:f0',
      reason: `EXAMPLE FAMILY FOUNDATION filed 990-PF for 3 tax year(s) (2021–2023); latest total expenses $2,500,000 (medium capacity). ${GAP_NO_GRANTEES}` });
    expect(funderSummary([{ ...rows[0], raw: { ein: 7 } }])).toEqual(expect.objectContaining({ ein: null, latest_expenses: null, capacity_band: 'unknown', reason: expect.stringContaining('not reported (unknown capacity)') }));
    expect(funderSummary([])).toEqual({ funder: null, ein: null, years: 0, data_years: [], latest_year: null, latest_expenses: null, capacity_band: 'unknown', reason: 'No 990-PF filing data stored for this funder.', source_ref: null });
  });
  it('byFunderName queries irs_990pf rows by funder with the caller client (RLS), newest first; errors surface', async () => {
    const calls: string[] = [], q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'ilike', 'order', 'limit']) q[m] = (...a: unknown[]) => { calls.push(`${m}(${a.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(',')})`); return q; };
    q.then = (res: (v: unknown) => void) => res({ data: rows, error: null });
    const got = await FunderHistoryQuery.byFunderName({ from: (t: string) => (calls.push(t), q) } as unknown as SupabaseClient, 'Example %Family_');
    expect(calls).toEqual(['award_history', `select(${FunderHistoryQuery.COLUMNS})`, 'eq(source,irs_990pf)', 'ilike(funder,%Example Family%)', 'order(fiscal_year,{"ascending":false})', 'limit(50)']);
    expect([got.years, got.latest_year, got.source_ref]).toEqual([3, 2023, 'award_history:f0']);
    q.then = (res: (v: unknown) => void) => res({ data: null, error: { message: 'boom' } });
    await expect(FunderHistoryQuery.byFunderName({ from: () => q } as unknown as SupabaseClient, 'x')).rejects.toThrow('boom');
  });
});
