import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { CommitHttp, RollbackHttp, supabaseIntakeDb } from '../../lib/intake/commit-http';
import { autoMap } from '../../lib/intake/mapping';
import { TEMPLATE_HEADERS, type IntakeEntity } from '../../lib/intake/schema';
import { COUNTIES } from '../../lib/synthetic/generate';

// F-604 dry run: docs/RUNBOOK_REAL_DATA.md sections 3 and 5 on synthetic data. A fresh org and admin, like a new production
// project, then all five entities in order through the same server path as /api/intake/commit, checks, rollback, cleanup.
const need = (name: string) => process.env[name] ?? (() => { throw new Error(`Missing ${name}. Run pnpm test:db`); })();
const API = need('SUPABASE_URL'), ANON = need('SUPABASE_ANON_KEY'), SVC = need('SUPABASE_SERVICE_ROLE_KEY');
assertLocalSupabase(API, need('SUPABASE_DB_URL'));
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const ORG = 'f6040000-0000-4000-8000-000000000604', EMAIL = 'dryrun-admin@example.test', N = 40;
const uid = (kind: number, i: number) => `f604${kind}000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const FIPS = ['49001', '49003', '49005', '49007', '49009', '49011', '49013', '49015', '49017', '49019', '49021', '49023', '49025', '49027', '49029',
  '49031', '49033', '49035', '49037', '49039', '49041', '49043', '49045', '49047', '49049', '49051', '49053', '49055', '49057'];
const day = (m: number, d: number) => `2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const range = Array.from({ length: N }, (_, i) => i);
/** One synthetic CSV per entity, keyed like the downloadable templates; `case` also carries a column the app must never store. */
const FILES: Record<IntakeEntity, Record<string, string>[]> = {
  case: range.map((i) => ({ id: uid(1, i), referral_source: 'court', court_involved: 'true', court_order_date: day(1, 1 + (i % 9)), referral_date: day(1, 12),
    county_fips: FIPS[i % FIPS.length]!, household_size: '3', income_band: i < 30 ? 'a' : 'b', prior_services: '', diagnosis: 'SYNTHETIC-NOT-STORED' })),
  application: range.map((i) => ({ id: uid(2, i), case_id: uid(1, i), application_date: day(2, 1), decision_date: day(2, 10), decision: 'approved', award_amount: '1200', family_contribution: '100' })),
  authorization: range.map((i) => ({ id: uid(3, i), application_id: uid(2, i), service_type: 'therapy', provider_id: '', units: '12', rate: '100', total_authorized: '1200' })),
  delivery: range.map((i) => ({ id: uid(4, i), authorization_id: uid(3, i), first_session_date: day(3, 1 + (i % 20)), last_session_date: day(5, 28), sessions_attended: '10', no_shows: '1',
    discharge_status: 'completed', non_start_reason: '', dollars_paid: '1000' })),
  outcome: range.map((i) => ({ id: uid(5, i), case_id: uid(1, i), measure_code: 'PHQ-9', baseline_score: '18', baseline_date: day(2, 15), followup_score: '9', followup_date: day(5, 15) })),
};
const TABLE: Record<IntakeEntity, string> = { case: 'case', application: 'application', authorization: 'authorization', delivery: 'delivery_episode', outcome: 'outcome_measure' };
const post = (body: unknown) => new Request('http://127.0.0.1/api/intake/commit', { method: 'POST', body: JSON.stringify(body) });
const upload = (entity: IntakeEntity, rows: Record<string, string>[]) => {
  const headers = [...TEMPLATE_HEADERS[entity], ...Object.keys(rows[0]!).filter((k) => !TEMPLATE_HEADERS[entity].includes(k))];
  return post({ entity, mapping: autoMap(headers, entity), headers, rows: rows.map((r) => headers.map((h) => r[h] ?? '')) });
};

describe('F-604 dry run: a real-data load rehearsed on synthetic data', () => {
  const svc = createClient(API, SVC, opts);
  let admin: SupabaseClient, userId = '';
  const batches: Partial<Record<IntakeEntity, string>> = {};
  const count = async (table: string) => (await svc.from(table).select('id', { count: 'exact', head: true }).eq('org_id', ORG)).count;

  beforeAll(async () => {
    await cleanup();
    expect((await svc.from('org').insert({ id: ORG, name: 'FAS Dry Run (synthetic)', uei: 'SYNTHETIC000', state: 'UT' })).error).toBeNull();
    const u = await svc.auth.admin.createUser({ email: EMAIL, password: 'testpass123', email_confirm: true, app_metadata: { role: 'admin', org_id: ORG } });
    expect(u.error).toBeNull();
    userId = u.data.user!.id;
    admin = createClient(API, ANON, opts);
    expect((await admin.auth.signInWithPassword({ email: EMAIL, password: 'testpass123' })).error).toBeNull();
  });
  async function cleanup() {
    for (const t of ['outcome_measure', 'delivery_episode', 'authorization', 'application', 'case', 'audit_log', 'upload_batch']) await svc.from(t).delete().eq('org_id', ORG);
    await svc.from('org').delete().eq('id', ORG);
    const users = await svc.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users.data?.users ?? []) if (u.email === EMAIL) await svc.auth.admin.deleteUser(u.id);
  }
  afterAll(cleanup);

  it('§3: reference data comes from migrations, so a project without the seed still has all 29 Utah counties', async () => {
    // seed.sql also inserts them locally, so prove the migration itself carries the full list production will get.
    const sql = readFileSync('supabase/migrations/20261017180000_f604_geo_county_utah.sql', 'utf8');
    expect([...sql.matchAll(/\('(49\d{3})', '([^']+)', 'UT'\)/g)].map((m) => `${m[1]} ${m[2]}`)).toEqual(COUNTIES.map((c) => `${c.fips} ${c.name}`));
    const { count: n } = await svc.from('geo_county').select('fips', { count: 'exact', head: true }).eq('state', 'UT');
    expect(n).toBe(29);
  });

  it('§5 step 2: a file with a bad county saves nothing and names the problem', async () => {
    const bad = [{ ...FILES.case[0]!, id: uid(9, 0), county_fips: '49999' }];
    const res = await CommitHttp.handle(upload('case', bad), 'admin', supabaseIntakeDb(admin));
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).toContain('county_fips');
    expect([await count('case'), await count('upload_batch')]).toEqual([0, 0]);
  });

  it('§5 step 2: all five entities load in order, one batch and one audit row each, every row stamped with the org and batch', async () => {
    for (const entity of ['case', 'application', 'authorization', 'delivery', 'outcome'] as const) {
      const res = await CommitHttp.handle(upload(entity, FILES[entity]), 'admin', supabaseIntakeDb(admin));
      const body = (await res.json()) as { batchId?: string; rows?: number; error?: string };
      expect([entity, res.status, body.rows]).toEqual([entity, 200, N]);
      batches[entity] = body.batchId!;
      expect(await count(TABLE[entity])).toBe(N);
      const stamped = await svc.from(TABLE[entity]).select('id', { count: 'exact', head: true }).eq('org_id', ORG).eq('upload_batch_id', body.batchId!);
      expect(stamped.count).toBe(N);
    }
    const ub = await svc.from('upload_batch').select('status,rows_ok,created_by').eq('org_id', ORG);
    expect(ub.data).toHaveLength(5);
    expect(ub.data!.every((b) => b.status === 'committed' && b.rows_ok === N && b.created_by === userId)).toBe(true);
    expect((await svc.from('audit_log').select('id', { count: 'exact', head: true }).eq('org_id', ORG).eq('action', 'intake.commit')).count).toBe(5);
  });

  it('§2: a column outside the template (here "diagnosis") is never stored anywhere', async () => {
    const rows = (await svc.from('case').select('*').eq('org_id', ORG)).data ?? [];
    expect(rows).toHaveLength(N);
    expect(rows.some((r) => 'diagnosis' in r)).toBe(false);
    expect(JSON.stringify(rows)).not.toContain('SYNTHETIC-NOT-STORED');
    const audit = (await svc.from('audit_log').select('details').eq('org_id', ORG)).data ?? [];
    expect(JSON.stringify(audit)).not.toContain('SYNTHETIC-NOT-STORED');
  });

  it('§5 step 3: the shared views show the load, and no count under 11 is ever visible', async () => {
    const views = { m1_summary_shared: ['n'], m4_completion_by_income_band_shared: ['completed', 'closed'], m6_dollars_by_provider_group_shared: ['episodes'] } as const;
    let shown = 0;
    for (const [view, cols] of Object.entries(views)) {
      const { data, error } = await admin.from(view).select('*').eq('org_id', ORG);
      expect([view, error]).toEqual([view, null]);
      for (const row of data ?? []) for (const c of cols) {
        const v = (row as Record<string, number | null>)[c];
        if (v != null) { shown++; expect([view, c, v >= 11]).toEqual([view, c, true]); }
      }
    }
    expect(shown).toBeGreaterThan(0);
    const bandB = (await admin.from('m4_completion_by_income_band_shared').select('completed,closed').eq('org_id', ORG).eq('income_band', 'b')).data ?? [];
    expect(bandB.every((r) => r.completed == null && r.closed == null)).toBe(true); // 10 band-b cases: hidden
  });

  it('§5 step 2.3: rolling back a batch removes exactly its rows, records it, and a second rollback is refused', async () => {
    const roll = (batchId: string) => RollbackHttp.handle(new Request('http://127.0.0.1/api/intake/rollback', { method: 'POST', body: JSON.stringify({ batchId }) }), 'admin', supabaseIntakeDb(admin));
    expect((await roll(batches.outcome!)).status).toBe(200);
    expect([await count('outcome_measure'), await count('case')]).toEqual([0, N]);
    expect((await svc.from('upload_batch').select('status').eq('id', batches.outcome!).single()).data?.status).toBe('rolled_back');
    expect((await svc.from('audit_log').select('id', { count: 'exact', head: true }).eq('org_id', ORG).eq('action', 'intake.rollback')).count).toBe(1);
    expect((await roll(batches.outcome!)).status).toBe(409);
  });
});
