import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';

const need = (name: string) => process.env[name] ?? (() => { throw new Error(`Missing ${name}. Run pnpm test:db`); })();
const API = need('SUPABASE_URL'), ANON = need('SUPABASE_ANON_KEY'), SVC = need('SUPABASE_SERVICE_ROLE_KEY');
assertLocalSupabase(API, need('SUPABASE_DB_URL'));
const ORG1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', STAFF = '22222222-2222-2222-2222-222222222222';
const CASE = { referral_source: 'court', court_involved: true, referral_date: '2024-02-15', county_fips: '49035', prior_services: ['none'] };
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const commit = (c: SupabaseClient, rows: unknown[], entity = 'case', mapping = {}) => c.rpc('intake_commit', { entity, mapping, rows });
const rollback = (c: SupabaseClient, batch_id: string) => c.rpc('intake_rollback', { batch_id });

describe('integration: intake_commit / intake_rollback', () => {
  const svc = createClient(API, SVC, opts), batches: string[] = [], c: Record<string, SupabaseClient> = { anon: createClient(API, ANON, opts) };
  const counts = () => Promise.all(['upload_batch', 'audit_log'].map((t) => svc.from(t).select('id', { count: 'exact', head: true }).eq('org_id', ORG1).then((r) => r.count)));
  beforeAll(async () => {
    for (const u of ['staff', 'board', 'other']) {
      c[u] = createClient(API, ANON, opts);
      const { error } = await c[u].auth.signInWithPassword({ email: `${u}@example.test`, password: 'testpass123' });
      if (error) throw error;
    }
  });
  afterAll(async () => {
    for (const id of batches) await svc.from('case').delete().eq('upload_batch_id', id);
    if (batches.length) await Promise.all([svc.from('audit_log').delete().in('entity_id', batches), svc.from('upload_batch').delete().in('id', batches)]);
  });
  it('staff commits: batch, stamped rows and audit row land in the staff org; board and anon cannot', async () => {
    const { data: id, error } = await commit(c.staff, [CASE, { ...CASE, id: crypto.randomUUID(), county_fips: '49049' }], 'case', { county_fips: 'County' });
    expect(error).toBeNull(); batches.push(id as string);
    expect((await svc.from('upload_batch').select('*').eq('id', id).single()).data).toMatchObject({ org_id: ORG1, entity: 'case', rows_ok: 2, rows_error: 0, status: 'committed', created_by: STAFF, mapping: { county_fips: 'County' } });
    expect((await svc.from('case').select('org_id, upload_batch_id, county_fips, prior_services').eq('upload_batch_id', id).order('county_fips')).data)
      .toEqual([{ org_id: ORG1, upload_batch_id: id, county_fips: '49035', prior_services: ['none'] }, { org_id: ORG1, upload_batch_id: id, county_fips: '49049', prior_services: ['none'] }]);
    expect((await svc.from('audit_log').select('actor, action, entity, details').eq('entity_id', id)).data).toEqual([{ actor: STAFF, action: 'intake.commit', entity: 'case', details: { entity: 'case', rows: 2 } }]);
    expect((await commit(c.board, [CASE])).error?.code).toBe('42501');
    expect((await commit(c.anon, [CASE])).error).toBeTruthy();
  });
  it('a row the database rejects rolls the whole commit back: no batch, no rows, no audit row', async () => {
    const before = await counts();
    expect((await commit(c.staff, [CASE, { ...CASE, county_fips: '99999' }])).error?.code).toBe('23503');
    expect((await commit(c.staff, [], 'provider')).error?.code).toBe('22023');
    expect(await counts()).toEqual(before);
  });
  it('rollback removes the rows, marks the batch and audits; other org gets not found; a second rollback conflicts', async () => {
    const id = (await commit(c.staff, [CASE])).data as string; batches.push(id);
    expect([(await rollback(c.other, id)).error?.code, (await rollback(c.board, id)).error?.code]).toEqual(['P0002', '42501']);
    expect(await rollback(c.staff, id)).toMatchObject({ error: null, data: 1 });
    expect((await svc.from('case').select('id').eq('upload_batch_id', id)).data).toEqual([]);
    expect((await svc.from('upload_batch').select('status').eq('id', id).single()).data).toEqual({ status: 'rolled_back' });
    expect((await svc.from('audit_log').select('action').eq('entity_id', id).order('action')).data).toEqual([{ action: 'intake.commit' }, { action: 'intake.rollback' }]);
    expect([(await rollback(c.staff, id)).error?.code, (await rollback(c.staff, crypto.randomUUID())).error?.code]).toEqual(['55000', 'P0002']);
  });
});
