import { describe, expect, it } from 'vitest';
import { AGGREGATE_METRICS, auditRow, formatValue, parsePeriod, periodLabel, rowForInsert, validateAggregate } from './aggregate';
import { AggregateHttp } from './aggregate-http';
import type { EntryDb } from './entry-http';

const ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', UID = '22222222-2222-2222-2222-222222222222', NEW = '12345678-0000-0000-0000-000000000000';
const ctx = { countyFips: new Set(['49035', '49049']) }, staff = { id: UID, role: 'staff', orgId: ORG };
const good = { period: '2026-Q2', metric: 'families_served', value: '42' };
const post = (body: unknown) => new Request('http://127.0.0.1/api/intake/aggregate', { method: 'POST', body: JSON.stringify(body) });
const errs = (input: Record<string, string>) => { const v = validateAggregate(input, ctx); return 'errors' in v ? v.errors.map((e) => `${e.column}:${e.code}`) : []; };

/** Fake client: one UT county, inserts recorded; RLS is covered by tests/db in CI. */
function fakeDb(failInsert?: string) {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const db: EntryDb = { from: (table) => ({
    select: () => ({ eq: () => Promise.resolve({ data: table === 'geo_county' ? [{ fips: '49035' }] : [], error: null }) }),
    insert: (row) => ({ select: () => ({ single: () => {
      inserts.push({ table, row });
      return Promise.resolve(failInsert === table ? { data: null, error: { message: 'boom' } } : { data: { id: NEW }, error: null });
    } }) }),
  }) };
  return { db, inserts };
}

describe('aggregate helpers', () => {
  it('parsePeriod accepts YYYY-Qn variants, rejects Q5/Q0/months/old years; labels and values format', () => {
    expect(['2026-Q2', ' 2026 q3', '2026Q1'].map(parsePeriod)).toEqual(['2026-Q2', '2026-Q3', '2026-Q1']);
    expect(['2026-Q5', '2026-Q0', '2026-06', '1999-Q1', 'Q2 2026', ''].map(parsePeriod)).toEqual([null, null, null, null, null, null]);
    expect([periodLabel('2026-Q2'), periodLabel('odd')]).toEqual(['Apr–Jun 2026 (Q2)', 'odd']);
    expect([formatValue('families_served', 1234), formatValue('dollars_paid', '1840'), formatValue('m1', null)]).toEqual(['1,234', '$1,840.00', '—']);
    expect(AGGREGATE_METRICS.map((m) => m.code)).toEqual(['families_served', 'episodes_completed', 'applications_approved', 'dollars_paid']);
  });
  it('validateAggregate: required fields, one error per field, non-negative whole counts, money, Utah county, note cap', () => {
    expect(errs({})).toEqual(['period:required', 'metric:required', 'value:required']);
    expect(errs({ period: '2026-Q5', metric: 'nope', value: 'x' })).toEqual(['period:type', 'metric:enum', 'value:type']);
    expect([errs({ ...good, value: '-5' }), errs({ ...good, value: '4.5' })]).toEqual([['value:min'], ['value:type']]);
    expect([errs({ ...good, county_fips: '99999' }), errs({ ...good, note: 'x'.repeat(201) })]).toEqual([['county_fips:county'], ['note:max']]);
    expect(validateAggregate({ period: '2026 q2', metric: 'dollars_paid', value: '$1,840.50', county_fips: '035', note: '  two   spaces ' }, ctx))
      .toEqual({ ok: { period: '2026-Q2', metric_code: 'dollars_paid', value: 1840.5, n: null, county_fips: '49035', notes: 'two spaces' } });
  });
  it('row shape: counts fill n, blanks store null, org and creator pinned; audit row names the metric', () => {
    const v = validateAggregate(good, ctx);
    if ('errors' in v) throw new Error('expected ok');
    expect(rowForInsert(v.ok, ORG, UID)).toEqual({ period: '2026-Q2', metric_code: 'families_served', value: 42, n: 42, county_fips: null, notes: null, org_id: ORG, created_by: UID });
    expect(auditRow(NEW, ORG, UID, 'families_served')).toEqual({ org_id: ORG, actor: UID, action: 'intake.aggregate', entity: 'aggregate_submission', entity_id: NEW, details: { metric_code: 'families_served' } });
  });
});

describe('AggregateHttp', () => {
  it('401 signed out, 403 board or no org, 400 bad body, 503 without a client', async () => {
    const { db } = fakeDb();
    expect((await AggregateHttp.handle(post(good), null, db)).status).toBe(401);
    expect((await AggregateHttp.handle(post(good), { ...staff, role: 'board_viewer' }, db)).status).toBe(403);
    expect((await AggregateHttp.handle(post(good), { ...staff, orgId: null }, db)).status).toBe(403);
    expect((await AggregateHttp.handle(post([1]), staff, db)).status).toBe(400);
    expect((await AggregateHttp.handle(post(good), staff, null)).status).toBe(503);
  });
  it('422 with field errors and nothing inserted; 201 inserts the total then an audit_log row; 500 on failures', async () => {
    const { db, inserts } = fakeDb();
    const bad = await AggregateHttp.handle(post({ ...good, period: '2026-Q5', value: -1 }), staff, db);
    expect([bad.status, ((await bad.json()) as { errors: { column: string }[] }).errors.map((e) => e.column), inserts]).toEqual([422, ['period', 'value'], []]);
    const res = await AggregateHttp.handle(post({ ...good, county_fips: '035' }), staff, db);
    expect([res.status, await res.json(), inserts.map((i) => i.table)]).toEqual([201, { id: NEW }, ['aggregate_submission', 'audit_log']]);
    expect(inserts[0].row).toMatchObject({ org_id: ORG, created_by: UID, county_fips: '49035', value: 42, n: 42 });
    expect(inserts[1].row).toMatchObject({ actor: UID, action: 'intake.aggregate', entity_id: NEW });
    expect((await AggregateHttp.handle(post(good), staff, fakeDb('aggregate_submission').db)).status).toBe(500);
    const half = await AggregateHttp.handle(post(good), staff, fakeDb('audit_log').db);
    expect([half.status, (await half.json()).id]).toEqual([500, NEW]);
  });
});
