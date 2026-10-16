import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';

// F-508g: application_draft RLS matrix, admin-only approval and the append-only edit history. Synthetic rows only.
const need = (name: string) => process.env[name] ?? (() => { throw new Error(`Missing ${name}. Run pnpm test:db`); })();
const API = need('SUPABASE_URL'), ANON = need('SUPABASE_ANON_KEY'), SVC = need('SUPABASE_SERVICE_ROLE_KEY');
assertLocalSupabase(API, need('SUPABASE_DB_URL'));
const ORG1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', OPP1 = '10101010-1010-1010-1010-101010101010', ADMIN = '11111111-1111-1111-1111-111111111111', STAFF = '22222222-2222-2222-2222-222222222222';
const USERS = { admin: 'admin', staff: 'staff', board: 'board', other: 'other', otherAdmin: 'other-admin' } as const;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe('integration: application_draft', () => {
  const svc = createClient(API, SVC, opts), c: Record<string, SupabaseClient> = {};
  let approved = '', unapproved = '';
  const draft = (strategy = approved, extra = {}) => ({ org_id: ORG1, opportunity_id: OPP1, strategy_draft_id: strategy, sections: [{ key: 's1', body: 'synthetic' }], ...extra });
  const insert = async (who: string, row = draft()) => c[who]!.from('application_draft').insert(row).select('id,created_by,status').single();
  beforeAll(async () => {
    for (const [k, u] of Object.entries(USERS)) {
      c[k] = createClient(API, ANON, opts);
      const { error } = await c[k].auth.signInWithPassword({ email: `${u}@example.test`, password: 'testpass123' });
      if (error) throw error;
    }
    const s = await svc.from('strategy_draft').insert([0, 1].map(() => ({ org_id: ORG1, opportunity_id: OPP1, status: 'DRAFT', output: {}, snapshot: { synthetic: true }, created_by: STAFF }))).select('id');
    [approved, unapproved] = (s.data ?? []).map((r) => r.id as string) as [string, string];
    expect((await c.admin!.from('strategy_draft').update({ status: 'approved' }).eq('id', approved).select('status').single()).data?.status).toBe('approved');
  });

  it('staff and admin insert DRAFT rows from an approved strategy; board, other orgs and unapproved strategies are refused', async () => {
    expect((await insert('staff')).data).toMatchObject({ created_by: STAFF, status: 'DRAFT' });
    expect((await insert('admin')).data).toMatchObject({ created_by: ADMIN });
    const refused = [['staff', draft(unapproved)], ['staff', draft(approved, { status: 'approved' })], ['board', draft()], ['other', draft()], ['otherAdmin', draft()]] as const;
    for (const [who, r] of refused) expect((await insert(who, r)).error).toBeTruthy();
  });

  it('only staff and admin in the org can select; board and other orgs see nothing', async () => {
    const id = (await insert('staff')).data!.id as string;
    for (const who of ['staff', 'admin']) expect((await c[who]!.from('application_draft').select('id').eq('id', id)).data).toHaveLength(1);
    for (const who of ['board', 'other', 'otherAdmin']) expect((await c[who]!.from('application_draft').select('id').eq('id', id)).data).toEqual([]);
    expect((await createClient(API, ANON, opts).from('application_draft').select('id').eq('id', id)).data ?? []).toEqual([]);
  });

  it('staff edits a DRAFT but cannot approve; admin approves with stamps; the approved row is frozen and never goes back to DRAFT', async () => {
    const id = (await insert('staff')).data!.id as string;
    expect((await c.staff!.from('application_draft').update({ sections: [{ key: 's1', body: 'edited' }] }).eq('id', id).select('sections').single()).data?.sections).toEqual([{ key: 's1', body: 'edited' }]);
    expect((await c.staff!.from('application_draft').update({ status: 'approved' }).eq('id', id).select()).error?.code).toBe('42501');
    expect((await c.board!.from('application_draft').update({ status: 'approved' }).eq('id', id).select()).data ?? []).toEqual([]);
    const ok = await c.admin!.from('application_draft').update({ status: 'approved', approved_by: STAFF }).eq('id', id).select('status,approved_by,approved_at').single();
    expect(ok.data).toMatchObject({ status: 'approved', approved_by: ADMIN, approved_at: expect.any(String) });
    expect((await c.staff!.from('application_draft').update({ sections: [] }).eq('id', id).select()).data).toEqual([]);
    expect((await c.admin!.from('application_draft').update({ sections: [] }).eq('id', id).select()).error?.code).toBe('42501');
    expect((await c.admin!.from('application_draft').update({ status: 'DRAFT' }).eq('id', id).select()).error?.code).toBe('42501');
    expect((await c.admin!.from('application_draft').update({ status: 'archived' }).eq('id', id).select('status').single()).data?.status).toBe('archived');
    expect((await c.admin!.from('application_draft').update({ status: 'DRAFT' }).eq('id', id).select()).error?.code).toBe('42501');
    expect((await svc.from('application_draft').select('status,sections').eq('id', id).single()).data).toEqual({ status: 'archived', sections: [{ key: 's1', body: 'edited' }] });
  });

  it('the edit history is append-only for everyone, and only DRAFT rows take edits', async () => {
    const id = (await insert('staff')).data!.id as string;
    const edit = { org_id: ORG1, application_draft_id: id, section_key: 's1', before: 'synthetic', after: 'edited' };
    const e = await c.staff!.from('application_draft_edit').insert(edit).select('id,editor').single();
    expect(e.data?.editor).toBe(STAFF);
    expect((await c.board!.from('application_draft_edit').insert(edit).select()).error).toBeTruthy();
    expect((await c.board!.from('application_draft_edit').select('id').eq('id', e.data!.id)).data).toEqual([]);
    expect((await c.admin!.from('application_draft_edit').update({ after: 'x' }).eq('id', e.data!.id).select()).data ?? []).toEqual([]);
    expect((await c.admin!.from('application_draft_edit').delete().eq('id', e.data!.id).select()).data ?? []).toEqual([]);
    for (const q of [svc.from('application_draft_edit').update({ after: 'x' }), svc.from('application_draft_edit').delete()]) expect((await q.eq('id', e.data!.id)).error?.code).toBe('42501');
    expect((await svc.from('application_draft_edit').select('after').eq('id', e.data!.id).single()).data?.after).toBe('edited');
    await c.admin!.from('application_draft').update({ status: 'archived' }).eq('id', id);
    expect((await c.staff!.from('application_draft_edit').insert(edit).select()).error).toBeTruthy();
  });
});
