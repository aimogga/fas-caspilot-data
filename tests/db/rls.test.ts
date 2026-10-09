import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'; // local CLI test_anon
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'; // local CLI test_service_role
const ORG1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const RID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const ACTORS = ['anon', 'admin', 'staff', 'board_viewer', 'other-org', 'other-admin', 'no-role'] as const;
const OPS = ['select', 'insert', 'update', 'delete'] as const;
const TABLES = ['geo_county', 'source_registry', 'ingest_run', 'public_indicator', 'need_score_config', 'need_score', 'org'] as const;
const SIGNED = new Set(['admin', 'staff', 'board_viewer', 'other-org', 'other-admin']);
type Actor = (typeof ACTORS)[number];
type Op = (typeof OPS)[number];
type Table = (typeof TABLES)[number];
type Rec = Record<string, unknown>;

const EMAIL: Record<Exclude<Actor, 'anon'>, string> = {
  admin: 'admin@example.test', staff: 'staff@example.test',
  board_viewer: 'board@example.test', 'other-org': 'other@example.test',
  'other-admin': 'other-admin@example.test', 'no-role': 'norole@example.test',
};
const M: Record<Table, { s: Rec; r: (t: string) => Rec; p: Rec; u: Rec }> = {
  geo_county: { s: { fips: '49035' }, r: (t) => ({ fips: t, name: t, state: 'UT', population_latest: 1 }), p: { name: 'X' }, u: { name: 'Salt Lake' } },
  source_registry: { s: { id: SID }, r: (t) => ({ name: t, owner: 'o', url: 'https://example.test', license: 'l', commercial_ok: false, cadence: 'n', status: 'paused' }), p: { cadence: 'x' }, u: { cadence: 'annual' } },
  ingest_run: { s: { id: RID }, r: (t) => ({ source_id: SID, status: 'ok', rows_loaded: 0, checksum: t }), p: { rows_loaded: 9 }, u: { rows_loaded: 1 } },
  public_indicator: { s: { vintage: '2023' }, r: (t) => ({ source_id: SID, indicator_code: t, geo_fips: '49035', period: '2023', value: 1, unit: 'n', vintage: t, ingest_run_id: RID }), p: { moe: 1 }, u: { moe: null } },
  need_score_config: { s: { version: 'v1' }, r: (t) => ({ version: t, weights: {} }), p: { weights: { x: 1 } }, u: { weights: { uninsured: 1 } } },
  need_score: { s: { version: 'v1', geo_fips: '49035' }, r: () => ({ version: 'v1', geo_fips: '49049', score: 1, components: {} }), p: { score: 9 }, u: { score: 0 } },
  org: { s: { id: ORG1 }, r: (t) => ({ name: t, ein: '00-0000099', uei: t, state: 'UT', settings: {} }), p: { uei: 'X' }, u: { uei: 'UEIFAS0001' } },
};

function allowed(table: Table, actor: Actor, op: Op): boolean {
  if (!SIGNED.has(actor)) return false;
  if (table !== 'org') return op === 'select';
  if (actor === 'other-org' || actor === 'other-admin') return false;
  return op === 'select' || (op === 'update' && actor === 'admin');
}

const clients: Partial<Record<Actor, SupabaseClient>> = {};
let svc: SupabaseClient;
let seq = 0;

describe('rls', () => {
  beforeAll(async () => {
    svc = createClient(URL, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const a of ACTORS) {
      const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
      if (a !== 'anon') {
        const { error } = await c.auth.signInWithPassword({ email: EMAIL[a], password: 'testpass123' });
        if (error) throw error;
      }
      clients[a] = c;
    }
  });

  it('pg_catalog: public tables have RLS on and at least one policy', async () => {
    const { data, error } = await clients.admin!.rpc('rls_guard_violations');
    expect(error).toBeNull();
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
});
