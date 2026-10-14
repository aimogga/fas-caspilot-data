import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../synthetic/generate';
import { buildBatchPayload, parentKeyFor, rowsForInsert, savedText } from './commit';
import { CommitHttp, RollbackHttp, dbStatus, type IntakeDb } from './commit-http';
import { TEMPLATE_HEADERS } from './schema';
import { validateRows } from './validate';

const ctx = { countyFips: new Set(COUNTIES.map((c) => c.fips)) }, CASE_ID = 'f1030000-0000-4000-a000-0000000003e8', BATCH = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';
const CASE_OK = { court_involved: 'yes', referral_date: '2024-02-15', county_fips: '49035', referral_source: 'court', court_order_date: '2024-02-01', prior_services: 'school counseling; none' };
const OUT = { case_id: CASE_ID, measure_code: 'PHQ-9', baseline_score: '12', baseline_date: '2024-01-01' };
const H = TEMPLATE_HEADERS.case, OH = TEMPLATE_HEADERS.outcome, same = (h: string[]) => Object.fromEntries(h.map((k) => [k, k])), MAP = same(H);
const row = (o: Record<string, string>, h = H) => h.map((k) => o[k] ?? '');
const req = (body: unknown) => new Request('http://127.0.0.1/api/intake/x', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const fakeDb = (over: Partial<IntakeDb> = {}, calls: unknown[] = []): IntakeDb => ({
  countyFips: async () => COUNTIES.map((c) => c.fips), knownIds: async (_t, c) => c.filter((id) => id === CASE_ID),
  commit: async (p) => { calls.push(p); return { data: BATCH, error: null }; }, rollback: async (id) => { calls.push(id); return { error: null }; }, ...over,
});
const commit = (rows: string[][], role: string | null = 'staff', db = fakeDb(), entity = 'case', headers = H) => CommitHttp.handle(req({ entity, mapping: same(headers), headers, rows }), role, db);
const rollback = (body: unknown, role: string | null = 'staff', db = fakeDb()) => RollbackHttp.handle(req(body), role, db);
const status = (ps: Promise<Response>[]) => Promise.all(ps).then((rs) => rs.map((r) => r.status));
describe('commit: helpers, CommitHttp, RollbackHttp', () => {
  it('parentKeyFor follows the schema uuid_ref fields; rowsForInsert drops a blank id and lists prior_services', () => {
    expect(['case', 'application', 'authorization', 'delivery'].map((e) => parentKeyFor(e as 'case')))
      .toEqual([{}, { case_id: 'case' }, { application_id: 'application', provider_id: 'provider' }, { authorization_id: 'authorization' }]);
    const { ok } = validateRows('case', [CASE_OK, { ...CASE_OK, id: CASE_ID, prior_services: '' }], ctx), rows = rowsForInsert('case', ok);
    expect(rows[0]).toEqual({ referral_source: 'court', court_involved: true, court_order_date: '2024-02-01', referral_date: '2024-02-15', county_fips: '49035', household_size: null, income_band: null, prior_services: ['school counseling', 'none'] });
    expect(rows[1]).toMatchObject({ id: CASE_ID, prior_services: [] });
    expect(buildBatchPayload('case', MAP, ok)).toEqual({ entity: 'case', mapping: MAP, rows });
    expect(rowsForInsert('outcome', validateRows('outcome', [OUT], { ...ctx, knownIds: { case_id: new Set([CASE_ID]) } }).ok)[0]).toEqual({ ...OUT, baseline_score: 12, followup_score: null, followup_date: null });
    expect([savedText(1, BATCH), savedText(3, BATCH)]).toEqual(['Saved 1 row as batch 0f0f0f0f', 'Saved 3 rows as batch 0f0f0f0f']);
    expect(['P0002', '55000', '42501', '23503', undefined].map((code) => dbStatus({ code, message: '' }))).toEqual([404, 409, 403, 409, 500]);
  });
  it('re-validates on the server, commits through the db and returns the batch id', async () => {
    const calls: unknown[] = [], res = await commit([row(CASE_OK), row({ ...CASE_OK, county_fips: '049' })], 'staff', fakeDb({}, calls));
    expect([res.status, await res.json()]).toEqual([200, { batchId: BATCH, rows: 2 }]);
    expect(calls[0]).toMatchObject({ entity: 'case', rows: [{ county_fips: '49035' }, { county_fips: '49049' }] });
  });
  it('422 with the error list and no write when any row fails; unknown parent ids fail as references', async () => {
    const calls: unknown[] = [], db = fakeDb({}, calls), res = await commit([row(CASE_OK), row({ ...CASE_OK, county_fips: '99999' })], 'admin', db);
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toEqual([{ row: 3, column: 'county_fips', code: 'county', message: 'County code 99999 is not a Utah county' }]);
    const r2 = await commit([row({ ...OUT, case_id: CASE_ID.replace('3e8', '999') }, OH)], 'admin', db, 'outcome', OH);
    expect((await r2.json()).errors[0]).toMatchObject({ column: 'case_id', code: 'reference' });
    expect(calls).toEqual([]);
  });
  it('401/403/400/413 and database error mapping on both routes', async () => {
    const rls = fakeDb({ commit: async () => ({ data: null, error: { code: '42501', message: 'rls' } }) }), ok = [row(CASE_OK)];
    expect(await status([commit(ok, null), commit(ok, 'board_viewer'), CommitHttp.handle(req('{nope'), 'staff', rls), commit(ok, 'staff', rls, 'provider'), commit([]), commit(Array(5001).fill(ok[0])), commit(ok, 'staff', rls)]))
      .toEqual([401, 403, 400, 400, 400, 413, 403]);
    const calls: unknown[] = [], fail = (code: string) => fakeDb({ rollback: async () => ({ error: { code, message: 'x' } }) });
    expect(await status([rollback({ batchId: BATCH }, 'staff', fakeDb({}, calls)), rollback({ batchId: 'nope' }), rollback({ batchId: BATCH }, 'board_viewer'), rollback({ batchId: BATCH }, 'admin', fail('P0002')), rollback({ batchId: BATCH }, 'admin', fail('55000'))]))
      .toEqual([200, 400, 403, 404, 409]);
    expect(calls).toEqual([BATCH]);
  });
});
