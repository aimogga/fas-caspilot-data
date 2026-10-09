import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'; // local CLI test_anon
const ORG1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const RID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const ACTORS = ['anon', 'admin', 'staff', 'board_viewer', 'other-org'] as const;
const OPS = ['select', 'insert', 'update', 'delete'] as const;
const TABLES = ['geo_county', 'source_registry', 'ingest_run', 'public_indicator', 'need_score_config', 'need_score', 'org'] as const;
type Actor = (typeof ACTORS)[number];
type Op = (typeof OPS)[number];
type Table = (typeof TABLES)[number];
type Rec = Record<string, unknown>;

const EMAIL: Record<Exclude<Actor, 'anon'>, string> = {
  admin: 'admin@example.test', staff: 'staff@example.test',
  board_viewer: 'board@example.test', 'other-org': 'other@example.test',
};
const M: Record<Table, { s: Rec; r: (t: string) => Rec; p: Rec; u: Rec; k: (row: Rec) => Rec }> = {
  geo_county: { s: { fips: '49035' }, r: (t) => ({ fips: t, name: t, state: 'UT', population_latest: 1 }), p: { name: 'X' }, u: { name: 'Salt Lake' }, k: (row) => ({ fips: row.fips }) },
  source_registry: { s: { id: SID }, r: (t) => ({ name: t, owner: 'o', url: 'https://example.test', license: 'l', commercial_ok: false, cadence: 'n', status: 'paused' }), p: { cadence: 'x' }, u: { cadence: 'annual' }, k: (row) => ({ id: row.id }) },
  ingest_run: { s: { id: RID }, r: (t) => ({ source_id: SID, status: 'ok', rows_loaded: 0, checksum: t }), p: { rows_loaded: 9 }, u: { rows_loaded: 1 }, k: (row) => ({ id: row.id }) },
  public_indicator: { s: { vintage: '2023' }, r: (t) => ({ source_id: SID, indicator_code: t, geo_fips: '49035', period: '2023', value: 1, unit: 'n', vintage: t, ingest_run_id: RID }), p: { moe: 1 }, u: { moe: null }, k: (row) => ({ id: row.id }) },
  need_score_config: { s: { version: 'v1' }, r: (t) => ({ version: t, weights: {} }), p: { weights: { x: 1 } }, u: { weights: { uninsured: 1 } }, k: (row) => ({ version: row.version }) },
  need_score: { s: { version: 'v1', geo_fips: '49035' }, r: () => ({ version: 'v1', geo_fips: '49049', score: 1, components: {} }), p: { score: 9 }, u: { score: 0 }, k: (row) => ({ version: row.version, geo_fips: row.geo_fips }) },
  org: { s: { id: ORG1 }, r: (t) => ({ name: t, ein: '00-0000099', uei: t, state: 'UT', settings: {} }), p: { uei: 'X' }, u: { uei: 'UEIFAS0001' }, k: (row) => ({ id: row.id }) },
};

function allowed(table: Table, actor: Actor, op: Op): boolean {
  if (actor === 'anon') return false;
  if (table === 'org') return op === 'select' ? actor !== 'other-org' : actor === 'admin';
  return op === 'select' || actor === 'admin';
}

const clients: Partial<Record<Actor, SupabaseClient>> = {};
let seq = 0;

describe('rls', () => {
  beforeAll(async () => {
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
    const { data, error } = await clients.anon!.rpc('rls_guard_violations');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(TABLES.flatMap((table) => ACTORS.flatMap((actor) => OPS.map((op) => ({ table, actor, op, allow: allowed(table, actor, op) })))))(
    '$actor $op $table allow=$allow',
    async ({ table, actor, op, allow }) => {
      const c = clients[actor]!;
      const admin = clients.admin!;
      const meta = M[table];
      if (op === 'select') {
        const { data } = await c.from(table).select('*').match(meta.s).limit(1);
        expect((data?.length ?? 0) > 0).toBe(allow);
        return;
      }
      const tag = `t${String(++seq).padStart(4, '0')}`;
      const row = meta.r(tag);
      if (op === 'insert') {
        const { data, error } = await c.from(table).insert(row).select();
        const ok = !error && (data?.length ?? 0) > 0;
        expect(ok).toBe(allow);
        if (ok) await admin.from(table).delete().match(meta.k(data![0] as Rec));
        return;
      }
      if (op === 'update') {
        const { data } = await c.from(table).update(meta.p).match(meta.s).select();
        expect((data?.length ?? 0) > 0).toBe(allow);
        if (allow) await admin.from(table).update(meta.u).match(meta.s);
        return;
      }
      if (allow) {
        const { data: ins, error } = await admin.from(table).insert(row).select();
        expect(error).toBeNull();
        const { data } = await c.from(table).delete().match(meta.k((ins?.[0] ?? row) as Rec)).select();
        expect((data?.length ?? 0) > 0).toBe(true);
        return;
      }
      const { data } = await c.from(table).delete().match(meta.s).select();
      expect((data?.length ?? 0) > 0).toBe(false);
      const { data: still } = await admin.from(table).select('*').match(meta.s).limit(1);
      expect((still?.length ?? 0) > 0).toBe(true);
    },
  );
});
