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
const P1 = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const P2 = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const C1 = '88888888-8888-8888-8888-888888888881';
const C2 = '88888888-8888-8888-8888-888888888882';
const A1 = '99999999-9999-9999-9999-999999999991';
const Z1 = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a1';
const ACTORS = ['anon', 'admin', 'staff', 'board_viewer', 'other-org', 'other-admin', 'no-role', 'org-norole'] as const;
const OPS = ['select', 'insert', 'update', 'delete'] as const;
const PUBLIC = ['geo_county', 'source_registry', 'ingest_run', 'public_indicator', 'need_score_config', 'need_score'] as const;
const FAS = ['case', 'application', 'authorization', 'provider', 'delivery_episode', 'outcome_measure', 'upload_batch', 'aggregate_submission'] as const;
const TABLES = [...PUBLIC, 'org', ...FAS] as const;
const SIGNED = new Set(['admin', 'staff', 'board_viewer', 'other-org', 'other-admin']);
type Actor = (typeof ACTORS)[number];
type Op = (typeof OPS)[number];
type Table = (typeof TABLES)[number];
type Rec = Record<string, unknown>;

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
  org: { s: { id: ORG1 }, r: (t) => ({ name: t, ein: '00-0000099', uei: t, state: 'UT', settings: {} }), p: { uei: 'X' }, u: { uei: 'UEIFAS0001' } },
  case: { s: { id: C1 }, r: (t) => ({ org_id: ORG1, referral_source: t, court_involved: false, county_fips: '49035', household_size: 2, income_band: 'a', prior_services: [], upload_batch_id: UB1 }), p: { income_band: 'x' }, u: { income_band: 'a' } },
  application: { s: { id: A1 }, r: (t) => ({ org_id: ORG1, case_id: C1, application_date: '2024-01-01', decision: t, award_amount: 1, family_contribution: 0 }), p: { award_amount: 9 }, u: { award_amount: 1 } },
  authorization: { s: { id: Z1 }, r: (t) => ({ org_id: ORG1, application_id: A1, service_type: t, provider_id: P1, units: 1, rate: 1, total_authorized: 1 }), p: { units: 9 }, u: { units: 1 } },
  provider: { s: { id: P1 }, r: (t) => ({ org_id: ORG1, name: t, npi: t, provider_affiliated: false }), p: { npi: 'X' }, u: { npi: '0000000001' } },
  delivery_episode: { s: { id: 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1' }, r: (t) => ({ org_id: ORG1, authorization_id: Z1, sessions_attended: 1, no_shows: 0, discharge_status: t, dollars_paid: 1 }), p: { no_shows: 9 }, u: { no_shows: 0 } },
  outcome_measure: { s: { id: 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c1' }, r: (t) => ({ org_id: ORG1, case_id: C1, measure_code: t, baseline_score: 1, baseline_date: '2024-01-01' }), p: { followup_score: 9 }, u: { followup_score: null } },
  upload_batch: { s: { id: UB1 }, r: (t) => ({ org_id: ORG1, file_path: t, mapping: {}, rows_ok: 0, rows_error: 0, status: 'ok' }), p: { status: 'x' }, u: { status: 'ok' } },
  aggregate_submission: { s: { id: 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d1' }, r: (t) => ({ org_id: ORG1, period: t, metric_code: 'm1', value: 1, n: 20, notes: t }), p: { notes: 'x' }, u: { notes: 'n' } },
};

function isFas(table: Table): boolean {
  return (FAS as readonly string[]).includes(table);
}

function allowed(table: Table, actor: Actor, op: Op): boolean {
  if (!SIGNED.has(actor)) return false;
  if (isFas(table)) return (actor === 'admin' || actor === 'staff') && (op !== 'delete' || actor === 'admin');
  if (table !== 'org') return op === 'select';
  if (actor === 'other-org' || actor === 'other-admin') return false;
  return op === 'select' || (op === 'update' && actor === 'admin');
}

function sql(q: string) {
  const pg = assertLocalSupabase(API, DB);
  execFileSync('psql', ['-h', pg.host, '-p', pg.port, '-U', pg.user, '-d', pg.database, '-v', 'ON_ERROR_STOP=1', '-At', '-c', q], { encoding: 'utf8', env: localPgEnv(pg) });
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
        const { data, error } = await c.from(table).insert(meta.r(tag)).select();
        expect(!error && (data?.length ?? 0) > 0).toBe(allow);
        return;
      }
      if (op === 'update') {
        const { data } = await c.from(table).update(meta.p).match(meta.s).select();
        expect((data?.length ?? 0) > 0).toBe(allow);
        if (allow) await svc.from(table).update(meta.u).match(meta.s);
        return;
      }
      if (isFas(table)) {
        const { data: created, error: insErr } = await svc.from(table).insert(meta.r(`d${tag}`)).select();
        expect(insErr).toBeNull();
        const id = (created as Rec[])[0]!.id;
        const { data } = await c.from(table).delete().eq('id', id).select();
        expect((data?.length ?? 0) > 0).toBe(allow);
        if (!allow) await svc.from(table).delete().eq('id', id);
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

  it('staff cannot insert with another org_id', async () => {
    const { data, error } = await clients.staff!.from('provider').insert({ org_id: ORG2, name: 'x', npi: '9', provider_affiliated: false }).select();
    expect(!error && (data?.length ?? 0) > 0).toBe(false);
  });

  it('staff cannot move a row org_id to another org', async () => {
    const { data } = await clients.staff!.from('provider').update({ org_id: ORG2 }).eq('id', P1).select();
    expect(data?.length ?? 0).toBe(0);
    const { data: still } = await svc.from('provider').select('org_id').eq('id', P1).single();
    expect(still?.org_id).toBe(ORG1);
  });

  it('child cannot reference a parent in another org', async () => {
    const { error } = await svc.from('application').insert({ org_id: ORG1, case_id: C2, application_date: '2024-01-01', decision: 'x' });
    expect(error).toBeTruthy();
  });

  it('other-org staff sees own FAS rows only', async () => {
    const c = clients['other-org']!;
    const { data: own } = await c.from('provider').select('id').eq('id', P2);
    expect(own?.length).toBe(1);
    const { data: leak } = await c.from('provider').select('id').eq('id', P1);
    expect(leak?.length ?? 0).toBe(0);
  });
});
