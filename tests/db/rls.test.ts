import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase, localPgEnv } from '../../lib/db/local-pg';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Run pnpm test:db (loads supabase status -o env).`);
  return v;
}
const API = need('SUPABASE_URL');
const ANON = need('SUPABASE_ANON_KEY');
const SVC = need('SUPABASE_SERVICE_ROLE_KEY');
const DB = need('SUPABASE_DB_URL');
assertLocalSupabase(API, DB);
const ORG1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const RID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const UB1 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
const UB2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2';
const P1 = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const P2 = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const C1 = '88888888-8888-8888-8888-888888888881';
const C2 = '88888888-8888-8888-8888-888888888882';
const A1 = '99999999-9999-9999-9999-999999999991';
const A2 = '99999999-9999-9999-9999-999999999992';
const Z1 = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a1';
const Z2 = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a2';
const OPP1 = '10101010-1010-1010-1010-101010101010';
const ADMIN = '11111111-1111-1111-1111-111111111111';
const STAFF = '22222222-2222-2222-2222-222222222222';
const ACTORS = ['anon', 'admin', 'staff', 'board_viewer', 'other-org', 'other-admin', 'no-role', 'org-norole'] as const;
const OPS = ['select', 'insert', 'update', 'delete'] as const;
const PUBLIC = ['geo_county', 'source_registry', 'ingest_run', 'public_indicator', 'need_score_config', 'need_score', 'fas_service_county', 'match_config'] as const;
const FAS = ['case', 'application', 'authorization', 'provider', 'delivery_episode', 'outcome_measure', 'upload_batch', 'aggregate_submission'] as const;
const GLOB = ['opportunity', 'opportunity_criteria', 'award_history', 'recipient_profile'] as const;
const GRW = ['match_result', 'strategy_draft', 'pipeline_status'] as const;
const JOB = ['export_job', 'audit_log'] as const;
const ORG_T = [...FAS, ...GRW, ...JOB] as const;
const TABLES = [...PUBLIC, 'org', ...FAS, ...GLOB, ...GRW, ...JOB] as const;
const ARCH = ['aggregate_submission','application','audit_log','authorization','award_history','case','delivery_episode','export_job','fas_service_county','geo_county','ingest_run','match_config','match_result',
  'need_score','need_score_config','opportunity','opportunity_criteria','org','outcome_measure','pipeline_status','provider','public_indicator','source_registry','strategy_draft','upload_batch'] as const;
const SIGNED = new Set(['admin', 'staff', 'board_viewer', 'other-org', 'other-admin']);
type Actor = (typeof ACTORS)[number];
type Op = (typeof OPS)[number];
type Table = (typeof TABLES)[number];
type Rec = Record<string, unknown>;
const TAG: Record<Table, string> = {
  geo_county: 'fips', source_registry: 'name', ingest_run: 'checksum', public_indicator: 'indicator_code',
  need_score_config: 'version', need_score: 'geo_fips', fas_service_county: 'fips', match_config: 'id', org: 'uei', case: 'referral_source',
  application: 'decision', authorization: 'service_type', provider: 'npi', delivery_episode: 'discharge_status',
  outcome_measure: 'measure_code', upload_batch: 'file_path', aggregate_submission: 'period',
  opportunity: 'external_id', opportunity_criteria: 'criterion', award_history: 'description', recipient_profile: 'recipient_key',
  match_result: 'model_version', strategy_draft: 'status', pipeline_status: 'notes',
  export_job: 'type', audit_log: 'action',
};
const UID: Record<Exclude<Actor, 'anon'>, string> = {
  admin: ADMIN, staff: STAFF, board_viewer: '33333333-3333-3333-3333-333333333333',
  'other-org': '44444444-4444-4444-4444-444444444444', 'other-admin': '55555555-5555-5555-5555-555555555555',
  'no-role': '66666666-6666-6666-6666-666666666666', 'org-norole': '77777777-7777-7777-7777-777777777777',
};

const EMAIL: Record<Exclude<Actor, 'anon'>, string> = {
  admin: 'admin@example.test', staff: 'staff@example.test',
  board_viewer: 'board@example.test', 'other-org': 'other@example.test',
  'other-admin': 'other-admin@example.test', 'no-role': 'norole@example.test',
  'org-norole': 'org-norole@example.test',
};
const M: Record<Table, { s: Rec; r: (t: string) => Rec; p: Rec; u: Rec }> = {
  geo_county: { s: { fips: '49035' }, r: (t) => ({ fips: t, name: t, state: 'UT', population_latest: 1 }), p: { name: 'X' }, u: { name: 'Salt Lake' } },
  source_registry: { s: { id: SID }, r: (t) => ({ name: t, owner: 'o', url: 'https://example.test', license: 'l', commercial_ok: false, cadence: 'n', status: 'paused' }), p: { cadence: 'x' }, u: { cadence: 'annual' } },
  ingest_run: { s: { id: RID }, r: (t) => ({ source_id: SID, status: 'ok', rows_loaded: 0, checksum: t }), p: { rows_loaded: 9 }, u: { rows_loaded: 1 } },
  public_indicator: { s: { vintage: '2023' }, r: (t) => ({ source_id: SID, indicator_code: t, geo_fips: '49035', period: '2023', value: 1, unit: 'n', vintage: t, ingest_run_id: RID }), p: { moe: 1 }, u: { moe: null } },
  need_score_config: { s: { version: 'v1' }, r: (t) => ({ version: t, weights: {} }), p: { weights: { x: 1 } }, u: { weights: { uninsured: 1 } } },
  need_score: { s: { version: 'v1', geo_fips: '49035' }, r: () => ({ version: 'v1', geo_fips: '49049', score: 1, components: {} }), p: { score: 9 }, u: { score: 0 } },
  fas_service_county: { s: { fips: '49035' }, r: () => ({ fips: '49001' }), p: { added_at: '2001-01-01' }, u: { added_at: '2026-10-13' } },
  match_config: { s: { id: 'v0-draft' }, r: (t) => ({ id: t, weights: {} }), p: { params: { x: 1 } }, u: { params: { prep_days: 30, themes_for_full_credit: 3, evidence_available: [] } } },
  org: { s: { id: ORG1 }, r: (t) => ({ name: t, ein: '00-0000099', uei: t, state: 'UT', settings: {} }), p: { uei: 'X' }, u: { uei: 'UEIFAS0001' } },
  case: { s: { id: C1 }, r: (t) => ({ org_id: ORG1, referral_source: t, court_involved: false, county_fips: '49035', household_size: 2, income_band: 'a', prior_services: [], upload_batch_id: UB1 }), p: { income_band: 'x' }, u: { income_band: 'a' } },
  application: { s: { id: A1 }, r: (t) => ({ org_id: ORG1, case_id: C1, application_date: '2024-01-01', decision: t, award_amount: 1, family_contribution: 0 }), p: { award_amount: 9 }, u: { award_amount: 1 } },
  authorization: { s: { id: Z1 }, r: (t) => ({ org_id: ORG1, application_id: A1, service_type: t, provider_id: P1, units: 1, rate: 1, total_authorized: 1 }), p: { units: 9 }, u: { units: 1 } },
  provider: { s: { id: P1 }, r: (t) => ({ org_id: ORG1, name: t, npi: t, provider_affiliated: false }), p: { npi: 'X' }, u: { npi: '0000000001' } },
  delivery_episode: { s: { id: 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1' }, r: (t) => ({ org_id: ORG1, authorization_id: Z1, sessions_attended: 1, no_shows: 0, discharge_status: t, dollars_paid: 1 }), p: { no_shows: 9 }, u: { no_shows: 0 } },
  outcome_measure: { s: { id: 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c1' }, r: (t) => ({ org_id: ORG1, case_id: C1, measure_code: t, baseline_score: 1, baseline_date: '2024-01-01' }), p: { followup_score: 9 }, u: { followup_score: null } },
  upload_batch: { s: { id: UB1 }, r: (t) => ({ org_id: ORG1, file_path: t, mapping: {}, rows_ok: 0, rows_error: 0, status: 'ok' }), p: { status: 'x' }, u: { status: 'ok' } },
  aggregate_submission: { s: { id: 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d1' }, r: (t) => ({ org_id: ORG1, period: t, metric_code: 'm1', value: 1, n: 20, notes: t }), p: { notes: 'x' }, u: { notes: 'n' } },
  opportunity: { s: { id: OPP1 }, r: (t) => ({ source: 'grants_gov', external_id: t, title: t, eligibility: {}, raw: {} }), p: { title: 'X' }, u: { title: 'Synth Opp' } },
  opportunity_criteria: { s: { id: '20202020-2020-2020-2020-202020202020' }, r: (t) => ({ opportunity_id: OPP1, criterion: t, weight_points: 1, text: t }), p: { weight_points: 9 }, u: { weight_points: 1 } },
  award_history: { s: { id: '30303030-3030-3030-3030-303030303030' }, r: (t) => ({ source: 'usaspending', funder: 'HHS', recipient: t, description: t, raw: {} }), p: { amount: 9 }, u: { amount: 1 } },
  recipient_profile: { s: { id: '31313131-3131-3131-3131-313131313131' }, r: (t) => ({ recipient_key: t, recipient: t, match_method: 'none', match_confidence: 'none' }), p: { ntee_code: 'X' }, u: { ntee_code: null } },
  match_result: { s: { id: '40404040-4040-4040-4040-404040404041' }, r: (t) => ({ org_id: ORG1, opportunity_id: OPP1, score: 1, components: {}, flags: {}, model_version: t }), p: { score: 9 }, u: { score: 1 } },
  strategy_draft: { s: { id: '50505050-5050-5050-5050-505050505051' }, r: (t) => ({ org_id: ORG1, opportunity_id: OPP1, inputs_snapshot: { t }, output: {}, citations: {}, status: 'draft' }), p: { status: 'approved' }, u: { status: 'draft' } },
  pipeline_status: { s: { opportunity_id: OPP1, org_id: ORG1 }, r: (t) => ({ opportunity_id: OPP1, org_id: ORG1, status: 'watch', notes: t }), p: { notes: 'x' }, u: { notes: 'n' } },
  export_job: { s: { id: '60606060-6060-6060-6060-606060606061' }, r: (t) => ({ org_id: ORG1, type: t, params: {}, suppression_applied: true, created_by: ADMIN }), p: { file_path: 'x' }, u: { file_path: '/synthetic/a.pdf' } },
  audit_log: { s: { id: '70707070-7070-7070-7070-707070707071' }, r: (t) => ({ org_id: ORG1, actor: ADMIN, action: t, entity: 'org', details: {} }), p: { action: 'x' }, u: { action: 'seed' } },
};

function inArr(table: Table, xs: readonly string[]): boolean {
  return xs.includes(table);
}

function allowed(table: Table, actor: Actor, op: Op): boolean {
  if (!SIGNED.has(actor)) return false;
  const own = actor === 'admin' || actor === 'staff';
  if (inArr(table, GLOB)) return op === 'select' && (own || actor === 'other-org' || actor === 'other-admin');
  if (inArr(table, FAS) || inArr(table, GRW)) return own && (op !== 'delete' || actor === 'admin');
  if (table === 'export_job') return own && (op === 'select' || op === 'insert');
  if (table === 'audit_log') return (op === 'select' && actor === 'admin') || (op === 'insert' && own);
  if (table !== 'org') return op === 'select';
  if (actor === 'other-org' || actor === 'other-admin') return false;
  return op === 'select' || (op === 'update' && actor === 'admin');
}

function sql(q: string): string {
  const pg = assertLocalSupabase(API, DB);
  return execFileSync('psql', ['-h', pg.host, '-p', pg.port, '-U', pg.user, '-d', pg.database, '-v', 'ON_ERROR_STOP=1', '-At', '-c', q], { encoding: 'utf8', env: localPgEnv(pg) });
}

function tagq(table: Table, t: string, row?: Rec): Rec {
  if (table === 'need_score') return { version: 'v1', geo_fips: '49049' };
  if (table === 'fas_service_county') return { fips: '49001' };
  if (table === 'strategy_draft' && row?.id) return { id: row.id };
  if (table === 'strategy_draft') return { inputs_snapshot: { t } };
  return { [TAG[table]]: t };
}

async function freshOpp(): Promise<string> {
  const { data, error } = await svc.from('opportunity').insert({ source: 'grants_gov', title: 'tmp', eligibility: {}, raw: {} }).select('id').single();
  expect(error).toBeNull();
  return data!.id as string;
}

async function prepInsert(table: Table, actor: Actor, tag: string): Promise<Rec> {
  const row = { ...M[table].r(tag) };
  if (table === 'export_job') row.created_by = actor === 'anon' ? ADMIN : UID[actor];
  if (table === 'audit_log') row.actor = actor === 'anon' ? ADMIN : UID[actor];
  if (table === 'strategy_draft') row.id = crypto.randomUUID();
  if (table === 'pipeline_status') row.opportunity_id = await freshOpp();
  return row;
}

async function landed(c: SupabaseClient, table: Table, row: Rec, q: Rec): Promise<boolean> {
  await c.from(table).insert(row);
  const { data } = await svc.from(table).select('*').match(q).limit(1);
  const did = (data?.length ?? 0) > 0;
  if (did) await svc.from(table).delete().match(q);
  return did;
}

function otherOrgRow(table: Table, t: string): Rec {
  const swap: Partial<Record<Table, Rec>> = {
    case: { upload_batch_id: UB2 }, application: { case_id: C2 },
    authorization: { application_id: A2, provider_id: P2 }, delivery_episode: { authorization_id: Z2 },
    outcome_measure: { case_id: C2 },
  };
  return { ...M[table].r(t), org_id: ORG2, ...swap[table] };
}

async function clearUserMeta(c: SupabaseClient) {
  await c.auth.updateUser({ data: { role: null, org_id: null } });
}

const clients: Partial<Record<Actor, SupabaseClient>> = {};
let svc: SupabaseClient;
let seq = 0;

describe('rls', () => {
  beforeAll(async () => {
    svc = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const a of ACTORS) {
      const c = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
      if (a !== 'anon') {
        const { error } = await c.auth.signInWithPassword({ email: EMAIL[a], password: 'testpass123' });
        if (error) throw error;
      }
      clients[a] = c;
    }
  });

  afterAll(async () => {
    for (const email of [EMAIL.staff, EMAIL['other-org']]) {
      const c = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
      await c.auth.signInWithPassword({ email, password: 'testpass123' });
      await clearUserMeta(c);
    }
  });

  it('anon cannot execute rls_guard_violations', async () => {
    const { error } = await clients.anon!.rpc('rls_guard_violations');
    expect(error).toBeTruthy();
  });

  it('pg_catalog: public tables have RLS on and at least one policy', async () => {
    const { data, error } = await clients.admin!.rpc('rls_guard_violations');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('guard flags a public table with RLS off and one with no policy', async () => {
    try {
      sql('CREATE TABLE public._rls_guard_probe(id int); CREATE TABLE public._rls_guard_nopol(id int); ALTER TABLE public._rls_guard_nopol ENABLE ROW LEVEL SECURITY; CREATE TABLE public._rls_guard_part(id int) PARTITION BY RANGE (id)');
      const { data, error } = await clients.admin!.rpc('rls_guard_violations');
      expect(error).toBeNull();
      const names = (data ?? []).map((r: { relname: string }) => r.relname);
      expect(names).toEqual(expect.arrayContaining(['_rls_guard_probe', '_rls_guard_nopol', '_rls_guard_part']));
    } finally {
      sql('DROP TABLE IF EXISTS public._rls_guard_probe, public._rls_guard_nopol, public._rls_guard_part');
    }
    const { data } = await clients.admin!.rpc('rls_guard_violations');
    expect(data).toEqual([]);
  });

  it.each(TABLES.flatMap((table) => ACTORS.flatMap((actor) => OPS.map((op) => ({ table, actor, op, allow: allowed(table, actor, op) })))))(
    '$actor $op $table allow=$allow',
    async ({ table, actor, op, allow }) => {
      const c = clients[actor]!;
      const meta = M[table];
      if (op === 'select') {
        const { data } = await c.from(table).select('*').match(meta.s).limit(1);
        expect((data?.length ?? 0) > 0).toBe(allow);
        return;
      }
      const tag = `t${String(++seq).padStart(4, '0')}`;
      if (op === 'insert') {
        const row = await prepInsert(table, actor, tag);
        expect(await landed(c, table, row, tagq(table, tag, row))).toBe(allow);
        if (table === 'pipeline_status') await svc.from('opportunity').delete().eq('id', row.opportunity_id);
        return;
      }
      if (op === 'update') {
        const { data } = await c.from(table).update(meta.p).match(meta.s).select();
        expect((data?.length ?? 0) > 0).toBe(allow);
        if (allow) await svc.from(table).update(meta.u).match(meta.s);
        return;
      }
      if (inArr(table, FAS) || inArr(table, GRW)) {
        const row = table === 'pipeline_status' ? { ...meta.r(`d${tag}`), opportunity_id: await freshOpp() } : meta.r(`d${tag}`);
        const { data: created, error: insErr } = await svc.from(table).insert(row).select();
        expect(insErr).toBeNull();
        const rec = (created as Rec[])[0]!;
        const q = table === 'pipeline_status' ? { opportunity_id: rec.opportunity_id, org_id: rec.org_id } : { id: rec.id };
        const { data } = await c.from(table).delete().match(q).select();
        expect((data?.length ?? 0) > 0).toBe(allow);
        if (!allow) await svc.from(table).delete().match(q);
        if (table === 'pipeline_status') await svc.from('opportunity').delete().eq('id', rec.opportunity_id);
        return;
      }
      const { data } = await c.from(table).delete().match(meta.s).select();
      expect((data?.length ?? 0) > 0).toBe(allow);
      const { data: still } = await svc.from(table).select('*').match(meta.s).limit(1);
      expect((still?.length ?? 0) > 0).toBe(true);
    },
  );

  it('other-admin can SELECT and UPDATE own org only', async () => {
    const c = clients['other-admin']!;
    const own = { id: ORG2 };
    const { data: seen } = await c.from('org').select('id').match(own).limit(1);
    expect(seen?.length).toBe(1);
    const { data: upd } = await c.from('org').update({ uei: 'Y' }).match(own).select();
    expect(upd?.length).toBe(1);
    await svc.from('org').update({ uei: 'UEIOTH0002' }).match(own);
    const { data: leak } = await c.from('org').select('id').eq('id', ORG1);
    expect(leak?.length ?? 0).toBe(0);
  });

  it('user_metadata role/org_id does not grant extra access', async () => {
    const c = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
      const { error: sign } = await c.auth.signInWithPassword({ email: EMAIL['other-org'], password: 'testpass123' });
      expect(sign).toBeNull();
      const { error: upd } = await c.auth.updateUser({ data: { role: 'admin', org_id: ORG1 } });
      expect(upd).toBeNull();
      await c.auth.refreshSession();
      const { data } = await c.from('org').select('id').eq('id', ORG1);
      expect(data?.length ?? 0).toBe(0);
      const { data: patched } = await c.from('org').update({ uei: 'Z' }).eq('id', ORG1).select();
      expect(patched?.length ?? 0).toBe(0);
    } finally {
      await clearUserMeta(c);
    }
  });

  it('user_metadata role does not escalate same-org staff', async () => {
    const c = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
      const { error: sign } = await c.auth.signInWithPassword({ email: EMAIL.staff, password: 'testpass123' });
      expect(sign).toBeNull();
      const { error: upd } = await c.auth.updateUser({ data: { role: 'admin' } });
      expect(upd).toBeNull();
      await c.auth.refreshSession();
      const { data: role } = await c.rpc('app_role');
      expect(role).toBe('staff');
      const { data: org } = await c.rpc('app_org_id');
      expect(org).toBe(ORG1);
      const { data: patched } = await c.from('org').update({ uei: 'Z' }).eq('id', ORG1).select();
      expect(patched?.length ?? 0).toBe(0);
    } finally {
      await clearUserMeta(c);
    }
  });

  it.each([...ORG_T].map((table) => ({ table })))('staff cannot insert $table with another org_id', async ({ table }) => {
    const tag = `x${String(++seq).padStart(4, '0')}`;
    const row = { ...otherOrgRow(table, tag), ...(table === 'export_job' ? { created_by: STAFF } : {}), ...(table === 'audit_log' ? { actor: STAFF } : {}) };
    expect(await landed(clients.staff!, table, row, tagq(table, tag, row))).toBe(false);
  });

  it('staff cannot move a row org_id to another org', async () => {
    const { data } = await clients.staff!.from('provider').update({ org_id: ORG2 }).eq('id', P1).select();
    expect(data?.length ?? 0).toBe(0);
    const { data: still } = await svc.from('provider').select('org_id').eq('id', P1).single();
    expect(still?.org_id).toBe(ORG1);
  });

  it.each([
    { table: 'case', col: 'upload_batch_id', row: { org_id: ORG1, referral_source: 'fk', upload_batch_id: UB2 }, q: { referral_source: 'fk' } },
    { table: 'application', col: 'case_id', row: { org_id: ORG1, case_id: C2, decision: 'fk' }, q: { decision: 'fk' } },
    { table: 'authorization', col: 'application_id', row: { org_id: ORG1, application_id: A2, service_type: 'fk-app' }, q: { service_type: 'fk-app' } },
    { table: 'authorization', col: 'provider_id', row: { org_id: ORG1, application_id: A1, provider_id: P2, service_type: 'fk-prov' }, q: { service_type: 'fk-prov' } },
    { table: 'delivery_episode', col: 'authorization_id', row: { org_id: ORG1, authorization_id: Z2, discharge_status: 'fk' }, q: { discharge_status: 'fk' } },
    { table: 'outcome_measure', col: 'case_id', row: { org_id: ORG1, case_id: C2, measure_code: 'fk' }, q: { measure_code: 'fk' } },
  ] as { table: Table; col: string; row: Rec; q: Rec }[])('$col on $table', async ({ table, row, q }) => {
    const { error } = await svc.from(table).insert(row);
    const { data } = await svc.from(table).select('id').match(q).limit(1);
    if (data?.length) await svc.from(table).delete().match(q);
    expect(error).toBeTruthy();
  });

  it('org-scoped org_id is NOT NULL', () => {
    const names = sql(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
      WHERE n.nspname='public' AND c.relkind='r' AND a.attname='org_id' AND a.attnotnull AND NOT a.attisdropped AND c.relname IN (${[...ORG_T].map((t) => `'${t}'`).join(',')}) ORDER BY 1`).trim().split('\n');
    expect(names).toEqual([...ORG_T].sort());
  });

  it('other-org staff sees own FAS rows only', async () => {
    const c = clients['other-org']!;
    const { data: own } = await c.from('provider').select('id').eq('id', P2);
    expect(own?.length).toBe(1);
    const { data: leak } = await c.from('provider').select('id').eq('id', P1);
    expect(leak?.length ?? 0).toBe(0);
    const { data: mown } = await c.from('match_result').select('id').eq('id', '40404040-4040-4040-4040-404040404042');
    expect(mown?.length).toBe(1);
    const { data: mleak } = await c.from('match_result').select('id').eq('id', '40404040-4040-4040-4040-404040404041');
    expect(mleak?.length ?? 0).toBe(0);
  });

  it('ARCHITECTURE.md tables exist with RLS and a policy', async () => {
    const names = sql(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
      AND EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid) AND c.relname IN (${[...ARCH].map((t) => `'${t}'`).join(',')}) ORDER BY 1`).trim().split('\n');
    expect(names).toEqual([...ARCH]);
    const { data, error } = await clients.admin!.rpc('rls_guard_violations');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('guard flags a public view without security_invoker', async () => {
    try {
      sql(`CREATE VIEW public._rls_guard_view AS SELECT 1 AS x; CREATE VIEW public._rls_guard_view_off WITH (security_invoker=false) AS SELECT 1 AS x;
        CREATE VIEW public._rls_guard_view_off2 WITH (security_invoker=off) AS SELECT 1 AS x; CREATE VIEW public._rls_guard_view_0 WITH (security_invoker=0) AS SELECT 1 AS x;
        CREATE VIEW public._rls_guard_view_no WITH (security_invoker=no) AS SELECT 1 AS x; CREATE VIEW public._rls_ok_view WITH (security_invoker=true) AS SELECT 1 AS x`);
      const { data, error } = await clients.admin!.rpc('rls_guard_violations');
      expect(error).toBeNull();
      const names = (data ?? []).map((r: { relname: string }) => r.relname);
      expect(names).toEqual(expect.arrayContaining(['_rls_guard_view', '_rls_guard_view_off', '_rls_guard_view_off2', '_rls_guard_view_0', '_rls_guard_view_no']));
      expect(names).not.toContain('_rls_ok_view');
    } finally {
      sql('DROP VIEW IF EXISTS public._rls_guard_view, public._rls_guard_view_off, public._rls_guard_view_off2, public._rls_guard_view_0, public._rls_guard_view_no, public._rls_ok_view');
    }
  });

  it('guard flags a public materialized view', async () => {
    try {
      sql('CREATE MATERIALIZED VIEW public._rls_guard_mat AS SELECT 1 AS x');
      const { data, error } = await clients.admin!.rpc('rls_guard_violations');
      expect(error).toBeNull();
      expect((data ?? []).map((r: { relname: string }) => r.relname)).toContain('_rls_guard_mat');
    } finally {
      sql('DROP MATERIALIZED VIEW IF EXISTS public._rls_guard_mat');
    }
  });

  it('audit_log is append-only and spoofed actor/created_by is denied', async () => {
    const admin = clients.admin!;
    const { data: upd } = await admin.from('audit_log').update({ action: 'x' }).eq('id', '70707070-7070-7070-7070-707070707071').select();
    expect(upd?.length ?? 0).toBe(0);
    const { data: del } = await admin.from('audit_log').delete().eq('id', '70707070-7070-7070-7070-707070707071').select();
    expect(del?.length ?? 0).toBe(0);
    expect((await svc.from('audit_log').select('id').eq('id', '70707070-7070-7070-7070-707070707071')).data?.length).toBe(1);
    const a = `s${String(++seq).padStart(4, '0')}`;
    const e = `s${String(++seq).padStart(4, '0')}`;
    expect(await landed(admin, 'audit_log', { ...M.audit_log.r(a), actor: STAFF }, tagq('audit_log', a))).toBe(false);
    expect(await landed(admin, 'export_job', { ...M.export_job.r(e), created_by: STAFF }, tagq('export_job', e))).toBe(false);
  });

  it.each([
    { table: 'opportunity' as Table, col: 'source', row: { ...M.opportunity.r('bogus'), source: 'bogus' } },
    { table: 'award_history' as Table, col: 'source', row: { ...M.award_history.r('bogus'), source: 'bogus' } },
    { table: 'strategy_draft' as Table, col: 'status', row: { ...M.strategy_draft.r('bogus'), status: 'bogus' } },
  ])('CHECK $col on $table rejects bogus', async ({ table, row }) => {
    const { error } = await svc.from(table).insert(row as Rec);
    const q = tagq(table, 'bogus', row);
    const { data } = await svc.from(table).select('*').match(q).limit(1);
    if (data?.length) await svc.from(table).delete().match(q);
    expect(error).toBeTruthy();
  });

  it.each([
    { t: 'pipeline_status', def: 'PRIMARY KEY (opportunity_id, org_id)' },
    { t: 'match_result', def: 'FOREIGN KEY (opportunity_id) REFERENCES opportunity(id)' },
    { t: 'strategy_draft', def: 'FOREIGN KEY (opportunity_id) REFERENCES opportunity(id)' },
    { t: 'opportunity_criteria', def: 'FOREIGN KEY (opportunity_id) REFERENCES opportunity(id)' },
    { t: 'match_result', def: 'FOREIGN KEY (org_id) REFERENCES org(id)' },
    { t: 'strategy_draft', def: 'FOREIGN KEY (org_id) REFERENCES org(id)' },
    { t: 'pipeline_status', def: 'FOREIGN KEY (org_id) REFERENCES org(id)' },
    { t: 'export_job', def: 'FOREIGN KEY (org_id) REFERENCES org(id)' },
    { t: 'audit_log', def: 'FOREIGN KEY (org_id) REFERENCES org(id)' },
    { t: 'opportunity', def: "CHECK ((source = ANY (ARRAY['grants_gov'::text, 'foundation_manual'::text, 'foundation_csv'::text])))" },
    { t: 'award_history', def: "CHECK ((source = ANY (ARRAY['usaspending'::text, 'irs_990pf'::text])))" },
    { t: 'recipient_profile', def: "CHECK ((match_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, 'none'::text])))" },
    { t: 'strategy_draft', def: "CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'rejected'::text])))" },
  ])('$t has $def', ({ t, def }) => {
    const got = sql(`SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname='${t}'`).trim().split('\n');
    expect(got).toContain(def);
  });

  it('server stamps audit_log.at and export_job.created_at', async () => {
    const admin = clients.admin!;
    const a = `s${String(++seq).padStart(4, '0')}`;
    const e = `s${String(++seq).padStart(4, '0')}`;
    await admin.from('audit_log').insert({ ...M.audit_log.r(a), actor: ADMIN, at: '2001-01-01' });
    await admin.from('export_job').insert({ ...M.export_job.r(e), created_by: ADMIN, created_at: '2099-01-01' });
    const now = Date.now();
    const { data: al } = await svc.from('audit_log').select('at').eq('action', a).maybeSingle();
    const { data: ej } = await svc.from('export_job').select('created_at').eq('type', e).maybeSingle();
    expect(Math.abs(new Date(al!.at as string).getTime() - now)).toBeLessThan(8000);
    expect(Math.abs(new Date(ej!.created_at as string).getTime() - now)).toBeLessThan(8000);
    await svc.from('audit_log').delete().eq('action', a);
    await svc.from('export_job').delete().eq('type', e);
  });

  it('anon and authenticated cannot TRUNCATE or TRIGGER public tables', () => {
    const bad = sql(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES ('anon'),('authenticated')) r(rolname)
      CROSS JOIN (VALUES ('TRUNCATE'),('TRIGGER')) p(priv) WHERE n.nspname='public' AND c.relkind IN ('r','p') AND has_table_privilege(r.rolname, c.oid, p.priv)`).trim();
    expect(bad).toBe('');
  });
});
