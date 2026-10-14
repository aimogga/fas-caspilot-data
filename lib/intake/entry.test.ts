import { describe, expect, it } from 'vitest';
import { auditRow, controlFor, emptyRow, hintFor, rowForInsert } from './entry';
import { EntryHttp, type EntryDb } from './entry-http';
import { INTAKE_ENTITIES, INTAKE_SCHEMA } from './schema';

const ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', UID = '22222222-2222-2222-2222-222222222222', CASE = '88888888-8888-8888-8888-888888888881';
const NEW = '12345678-0000-0000-0000-000000000000';
const staff = { id: UID, role: 'staff', orgId: ORG };
const post = (body: unknown) => new Request('http://127.0.0.1/api/intake/entry', { method: 'POST', body: JSON.stringify(body) });

/** Fake client: UT counties, one known case, inserts recorded; RLS is covered by tests/db in CI. */
function fakeDb(opts: { failInsert?: string } = {}) {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const ok = (data: Record<string, unknown>[]) => Promise.resolve({ data, error: null });
  const db: EntryDb = {
    from: (table) => ({
      select: () => ({ eq: (_c, v) => (table === 'geo_county' ? ok([{ fips: '49035' }, { fips: '49049' }]) : ok(table === 'case' && v === CASE ? [{ id: CASE }] : [])) }),
      insert: (row) => {
        const run = () => {
          inserts.push({ table, row });
          return Promise.resolve(opts.failInsert === table ? { data: null, error: { message: 'boom' } } : { data: { id: NEW }, error: null });
        };
        // Awaitable like the real builder (audit rows are inserted without RETURNING) and selectable for the record insert.
        return { then: (f, r) => run().then(f, r), select: () => ({ single: run }) };
      },
    }),
  };
  return { db, inserts };
}

describe('entry helpers', () => {
  it('emptyRow covers every field; controlFor hides the id and picks a control per type', () => {
    for (const e of INTAKE_ENTITIES) expect(Object.keys(emptyRow(e))).toEqual(INTAKE_SCHEMA[e].fields.map((f) => f.key));
    const by = Object.fromEntries(INTAKE_SCHEMA.case.fields.map((f) => [f.key, controlFor(f)]));
    expect(by).toMatchObject({ id: 'hidden', referral_source: 'select', court_involved: 'yesno', referral_date: 'date', county_fips: 'county', household_size: 'number', prior_services: 'text' });
    expect(controlFor(INTAKE_SCHEMA.application.fields[1])).toBe('ref');
    expect(hintFor(INTAKE_SCHEMA.application.fields[1])).toBe('Paste the parent record id');
  });
  it('rowForInsert drops blanks and id, pins org_id, and turns prior_services into a json array', () => {
    const row = rowForInsert('case', { id: null, court_involved: true, referral_date: '2024-03-01', county_fips: '49035', household_size: null, prior_services: 'IOP; school counselor' }, ORG);
    expect(row).toEqual({ org_id: ORG, court_involved: true, referral_date: '2024-03-01', county_fips: '49035', prior_services: ['IOP', 'school counselor'] });
    expect(auditRow('case', NEW, ORG, UID)).toEqual({ org_id: ORG, actor: UID, action: 'intake.entry', entity: 'case', entity_id: NEW, details: { table: 'case' } });
  });
});

describe('EntryHttp', () => {
  const good = { entity: 'case', row: { court_involved: 'yes', referral_date: '2024-03-01', county_fips: '035' } };
  it('401 signed out, 403 board or no org, 400 bad entity or body, 503 without a client', async () => {
    const { db } = fakeDb();
    expect((await EntryHttp.handle(post(good), null, db)).status).toBe(401);
    expect((await EntryHttp.handle(post(good), { ...staff, role: 'board_viewer' }, db)).status).toBe(403);
    expect((await EntryHttp.handle(post(good), { ...staff, orgId: null }, db)).status).toBe(403);
    expect((await EntryHttp.handle(post({ entity: 'provider', row: {} }), staff, db)).status).toBe(400);
    expect((await EntryHttp.handle(post({ entity: 'case', row: [] }), staff, db)).status).toBe(400);
    expect((await EntryHttp.handle(post(good), staff, null)).status).toBe(503);
  });
  it('422 with the upload validator errors; nothing inserted', async () => {
    const { db, inserts } = fakeDb();
    const res = await EntryHttp.handle(post({ entity: 'application', row: { case_id: NEW, application_date: '2024-05-01', decision_date: '2024-04-01' } }), staff, db);
    expect(res.status).toBe(422);
    const { errors } = (await res.json()) as { errors: { column: string; message: string }[] };
    expect(errors.map((e) => e.column).sort()).toEqual(['case_id', 'decision_date']);
    expect(errors.find((e) => e.column === 'case_id')?.message).toContain('does not match any existing record');
    expect(inserts).toEqual([]);
  });
  it('201 inserts the row with org_id (county padded to 5 digits) then an audit_log row by the actor', async () => {
    const { db, inserts } = fakeDb();
    const res = await EntryHttp.handle(post(good), staff, db);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: NEW });
    expect(inserts.map((i) => i.table)).toEqual(['case', 'audit_log']);
    expect(inserts[0].row).toEqual({ org_id: ORG, court_involved: true, referral_date: '2024-03-01', county_fips: '49035' });
    expect(inserts[1].row).toMatchObject({ org_id: ORG, actor: UID, action: 'intake.entry', entity: 'case', entity_id: NEW });
    expect((await EntryHttp.handle(post({ entity: 'application', row: { case_id: CASE, application_date: '2024-05-01' } }), staff, db)).status).toBe(201);
  });
  it('500 when the insert fails, and when only the audit row fails (id still returned)', async () => {
    expect((await EntryHttp.handle(post(good), staff, fakeDb({ failInsert: 'case' }).db)).status).toBe(500);
    const res = await EntryHttp.handle(post(good), staff, fakeDb({ failInsert: 'audit_log' }).db);
    expect([res.status, (await res.json()).id]).toEqual([500, NEW]);
  });
});
