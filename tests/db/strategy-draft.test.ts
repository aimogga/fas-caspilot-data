import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';

// F-508e: strategy_draft review rules beyond the rls.test.ts matrix (insert status, admin-only approval, failed never approvable).
const need = (name: string) => process.env[name] ?? (() => { throw new Error(`Missing ${name}. Run pnpm test:db`); })();
const API = need('SUPABASE_URL'), ANON = need('SUPABASE_ANON_KEY'), SVC = need('SUPABASE_SERVICE_ROLE_KEY');
assertLocalSupabase(API, need('SUPABASE_DB_URL'));
const ORG1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', OPP1 = '10101010-1010-1010-1010-101010101010', ADMIN = '11111111-1111-1111-1111-111111111111', STAFF = '22222222-2222-2222-2222-222222222222';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const row = (status: string) => ({ org_id: ORG1, opportunity_id: OPP1, status, output: {}, snapshot: { synthetic: true }, citation_report: { ok: status === 'DRAFT' } });

describe('integration: strategy_draft review', () => {
  const svc = createClient(API, SVC, opts), c: Record<string, SupabaseClient> = {}, ids: string[] = [];
  const insert = async (who: string, status: string) => {
    const r = await c[who]!.from('strategy_draft').insert(row(status)).select('id,created_by').single();
    if (r.data) ids.push(r.data.id as string);
    return r;
  };
  beforeAll(async () => {
    for (const u of ['admin', 'staff', 'board']) {
      c[u] = createClient(API, ANON, opts);
      const { error } = await c[u].auth.signInWithPassword({ email: `${u}@example.test`, password: 'testpass123' });
      if (error) throw error;
    }
  });
  afterAll(async () => { if (ids.length) await svc.from('strategy_draft').delete().in('id', ids); });

  it('staff inserts DRAFT and failed rows stamped with created_by; nobody inserts an approved row; board cannot insert', async () => {
    expect((await insert('staff', 'DRAFT')).data?.created_by).toBe(STAFF);
    expect((await insert('staff', 'failed')).error).toBeNull();
    expect((await insert('staff', 'approved')).error).toBeTruthy();
    expect((await insert('admin', 'approved')).error).toBeTruthy();
    expect((await insert('board', 'DRAFT')).error).toBeTruthy();
  });

  it('only admin approves a DRAFT; approval stamps approved_by and approved_at and freezes the output', async () => {
    const { data } = await insert('staff', 'DRAFT');
    const id = data!.id as string;
    expect((await c.staff!.from('strategy_draft').update({ status: 'approved' }).eq('id', id).select()).data).toEqual([]);
    expect((await c.board!.from('strategy_draft').select('id').eq('id', id)).data).toEqual([]);
    const ok = await c.admin!.from('strategy_draft').update({ status: 'approved', output: { changed: true }, approved_by: STAFF }).eq('id', id).select('status,approved_by,approved_at,output').single();
    expect(ok.error).toBeNull();
    expect(ok.data).toMatchObject({ status: 'approved', approved_by: ADMIN, output: {} });
    expect(ok.data!.approved_at).toBeTruthy();
  });

  it('a failed draft can never be approved, even by admin', async () => {
    const { data } = await insert('staff', 'failed');
    const r = await c.admin!.from('strategy_draft').update({ status: 'approved' }).eq('id', data!.id).select();
    expect(r.error?.code).toBe('22023');
  });
});
