import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertHost, assertOutsideRepo, FAS_DEV_HOST, importKnowledge, parseArgs, run, supabaseDb, validate } from './knowledge-import.mjs';

const FIXTURE = 'tests/fixtures/knowledge/bluebird-import.json';
const doc = () => JSON.parse(readFileSync(FIXTURE, 'utf8'));
const ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ADMIN = '11111111-1111-1111-1111-111111111111';
const OPTS = { org: ORG, approver: 'admin@example.test' };

/** Stateful stand-in for the service-role adapter: an update bumps the version like the stamp trigger does. */
function mockDb({ role = 'admin', orgId = ORG } = {}) {
  const rows = [], writes = [];
  return {
    rows, writes,
    findOrg: async (ref) => [{ id: ORG, name: 'Bluebird Family Fund' }].filter((o) => o.id === ref || o.name === ref),
    findUser: async (email) => (email === OPTS.approver ? { id: ADMIN, app_metadata: { role, org_id: orgId } } : null),
    listImported: async () => rows.map((r) => ({ ...r })),
    insert: async (r) => { writes.push(['insert', r]); rows.push({ id: `k${rows.length}`, version: 1, ...r }); },
    update: async (id, f) => { writes.push(['update', id, f]); const r = rows.find((x) => x.id === id); Object.assign(r, f, { version: r.version + 1 }); },
  };
}

describe('validate', () => {
  it('falls back to the file source_document and as_of', () => {
    const { failures, rows } = validate(doc());
    expect(failures).toEqual([]);
    expect(rows[0]).toMatchObject({ import_key: 'mission', source: 'Bluebird Family Fund narrative kit (fictional)', as_of: '2026-01-15' });
  });
  it('runs the source line through the text rules, named as source:<rule>, never echoed', () => {
    const d = doc();
    d.entries[0].source = 'Call 801-555-0123 for the fictional report';
    d.entries[1].source = '   ';
    const { failures } = validate(d);
    expect(failures).toEqual([{ key: 'mission', rules: ['source:phone'] }, { key: 'completion', rules: ['needs_source'] }]);
    expect(JSON.stringify(failures)).not.toContain('555');
    d.source_document = 'Ask jane@example.test';
    d.entries[0].source = null;
    expect(validate(d).failures).toContainEqual({ key: 'mission', rules: ['source:email'] });
  });
  it('names key and rule for bad shape, duplicates and dates', () => {
    const d = doc();
    d.entries.push({ ...d.entries[0] }, { key: 'x', category: 'nope', status: 'final', title: 'T', body: 'ok', as_of: '2026-02-30' });
    expect(validate(d).failures).toEqual([{ key: 'mission', rules: ['duplicate_key'] }, { key: 'x', rules: ['bad_category', 'bad_status', 'bad_as_of'] }]);
    expect(validate({}).failures).toEqual([{ key: '(file)', rules: ['bad_shape'] }]);
  });
});

describe('importKnowledge', () => {
  it('all-or-nothing: one guard failure writes nothing and never echoes the text', async () => {
    const d = doc(), db = mockDb();
    d.entries[2].body = 'Call the fictional office at 801-555-0123.';
    const res = await importKnowledge(db, d, OPTS);
    expect(res).toEqual({ ok: false, failures: [{ key: 'closing', rules: ['phone'] }] });
    expect(JSON.stringify(res)).not.toContain('555');
    expect(db.writes).toEqual([]);
  });
  it('creates rows with approver stamps; drafts stay draft', async () => {
    const db = mockDb();
    expect(await importKnowledge(db, doc(), OPTS)).toMatchObject({ ok: true, created: 3, updated: 0, unchanged: 0, missing: [] });
    expect(db.rows.map((r) => [r.import_key, r.status, r.approved_by, r.created_by, r.org_id])).toEqual([
      ['mission', 'approved', ADMIN, ADMIN, ORG], ['completion', 'approved', ADMIN, ADMIN, ORG], ['closing', 'draft', null, ADMIN, ORG]]);
  });
  it('is idempotent: a re-run with the same file writes nothing', async () => {
    const db = mockDb();
    await importKnowledge(db, doc(), OPTS);
    const n = db.writes.length;
    expect(await importKnowledge(db, doc(), OPTS)).toMatchObject({ created: 0, updated: 0, unchanged: 3 });
    expect(db.writes.length).toBe(n);
  });
  it('changed text updates the same row (a new version) and skips the rest', async () => {
    const db = mockDb(), d = doc();
    await importKnowledge(db, d, OPTS);
    d.entries[0].body += ' Edited.';
    expect(await importKnowledge(db, d, OPTS)).toMatchObject({ created: 0, updated: 1, unchanged: 2 });
    expect(db.writes.at(-1)).toEqual(['update', 'k0', expect.objectContaining({ body: d.entries[0].body, approved_by: ADMIN })]);
    expect(db.rows[0].version).toBe(2);
    expect(db.rows).toHaveLength(3);
  });
  it('reports missing entries and archives them only with archiveMissing', async () => {
    const db = mockDb(), d = doc();
    await importKnowledge(db, d, OPTS);
    d.entries.pop();
    expect(await importKnowledge(db, d, OPTS)).toMatchObject({ missing: ['closing'], archived: 0 });
    expect(db.rows[2].status).toBe('draft');
    expect(await importKnowledge(db, d, { ...OPTS, archiveMissing: true })).toMatchObject({ missing: ['closing'], archived: 1 });
    expect(db.rows[2].status).toBe('archived');
    expect(db.writes.some(([op]) => op === 'delete')).toBe(false);
  });
  it.each([['staff', ORG], ['admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']])('refuses a %s approver of org %s', async (role, orgId) => {
    const db = mockDb({ role, orgId });
    await expect(importKnowledge(db, doc(), OPTS)).rejects.toThrow('must be an admin of that org');
    await expect(importKnowledge(db, doc(), { ...OPTS, approver: 'nobody@example.test' })).rejects.toThrow('admin');
    expect(db.writes).toEqual([]);
  });
  it('refuses an unknown org', async () => {
    await expect(importKnowledge(mockDb(), doc(), { ...OPTS, org: 'No Such Org' })).rejects.toThrow('No org matches');
  });
  it('dry run plans but writes nothing', async () => {
    const db = mockDb();
    expect(await importKnowledge(db, doc(), { ...OPTS, dryRun: true, archiveMissing: true })).toMatchObject({ dryRun: true, created: 3, archived: 0 });
    expect(db.writes).toEqual([]);
  });
});

describe('supabaseDb', () => {
  it('listImported reads every page, not just the first 1,000 rows', async () => {
    const all = Array.from({ length: 2500 }, (_, i) => ({ id: `k${i}`, import_key: `key-${i}` })), ranges = [];
    const q = { select: () => q, eq: () => q, not: () => q, order: () => q,
      range: async (a, b) => { ranges.push([a, b]); return { data: all.slice(a, b + 1), error: null }; } };
    const rows = await supabaseDb({ from: () => q }).listImported(ORG);
    expect(rows).toHaveLength(2500);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
});

describe('guards', () => {
  it('refuses a file inside the repo and accepts one outside', () => {
    expect(() => assertOutsideRepo(FIXTURE)).toThrow('outside the repo');
    expect(() => assertOutsideRepo('package.json')).toThrow('outside the repo');
    const out = join(mkdtempSync(join(tmpdir(), 'kn-')), 'kit.knowledge.json');
    writeFileSync(out, '{}');
    expect(assertOutsideRepo(out)).toContain('kit.knowledge.json');
  });
  it('allows only fas-dev or local unless --allow-host names the host', () => {
    expect(assertHost(`https://${FAS_DEV_HOST}`)).toBe(FAS_DEV_HOST);
    expect(assertHost('http://127.0.0.1:54321')).toBe('127.0.0.1');
    expect(() => assertHost('https://dhlvtisumrvhnqbeidlt.supabase.co')).toThrow('Refusing');
    expect(assertHost('https://other.example.test', 'other.example.test')).toBe('other.example.test');
  });
  it('parses flags and needs file, org and approver', () => {
    expect(parseArgs(['/x/kit.json', '--org', ORG, '--approver', 'a@b.test', '--dry-run'])).toMatchObject({ file: '/x/kit.json', org: ORG, dryRun: true, archiveMissing: false });
    expect(() => parseArgs(['/x/kit.json', '--org', ORG])).toThrow('Usage');
    expect(() => parseArgs(['/x/kit.json', '--org', '--approver', 'a@b.test'])).toThrow('Usage');
  });
  it('run checks env and host before touching the database', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'kn-')), 'kit.knowledge.json');
    writeFileSync(out, JSON.stringify(doc()));
    const argv = [out, '--org', ORG, '--approver', OPTS.approver];
    await expect(run(argv, {})).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY');
    await expect(run(argv, { SUPABASE_URL: 'https://prod.example.test', SUPABASE_SERVICE_ROLE_KEY: 'placeholder' })).rejects.toThrow('Refusing');
    await expect(run([FIXTURE, ...argv.slice(1)], {})).rejects.toThrow('outside the repo');
  });
});
