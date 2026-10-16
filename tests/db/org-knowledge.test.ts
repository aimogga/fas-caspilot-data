import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { listApproved, resolveCitation, saveKnowledge, sourceRef } from '../../lib/knowledge/store';

const env = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}. Run pnpm test:db.`); return v; };
const API = env('SUPABASE_URL'), ANON = env('SUPABASE_ANON_KEY'), SVC = env('SUPABASE_SERVICE_ROLE_KEY');
assertLocalSupabase(API, env('SUPABASE_DB_URL'));
const ORG1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ORG2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', ADMIN = '11111111-1111-1111-1111-111111111111';
const EMAIL = { admin: 'admin@example.test', staff: 'staff@example.test', board_viewer: 'board@example.test', 'other-admin': 'other-admin@example.test', 'no-role': 'norole@example.test' };
type Actor = keyof typeof EMAIL | 'anon';
const ACTORS: Actor[] = ['anon', 'admin', 'staff', 'board_viewer', 'other-admin', 'no-role'];
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(API, SVC, opts), clients = {} as Record<Actor, SupabaseClient>;
const row = (org: string, title: string, status = 'approved') => ({ org_id: org, category: 'program', title, body: `Fictional program text for ${title}.`, status });
let APPROVED = '', DRAFT = '', OTHER = '';

const make = async (r: Record<string, unknown>) => (await svc.from('org_knowledge').insert(r).select('id').single()).data!.id as string;

beforeAll(async () => {
  for (const a of ACTORS) {
    const c = createClient(API, ANON, opts);
    if (a !== 'anon') { const { error } = await c.auth.signInWithPassword({ email: EMAIL[a], password: 'testpass123' }); if (error) throw error; }
    clients[a] = c;
  }
  [APPROVED, DRAFT, OTHER] = [await make(row(ORG1, 'kn-approved')), await make(row(ORG1, 'kn-draft', 'draft')), await make(row(ORG2, 'kn-other'))];
});

describe.each(['org_knowledge', 'org_knowledge_version'] as const)('%s RLS', (table) => {
  const key = table === 'org_knowledge' ? 'id' : 'knowledge_id';
  it.each(ACTORS)('%s select: admin all own-org rows, staff approved only, others nothing', async (a) => {
    const seen = async (id: string) => ((await clients[a].from(table).select(key).eq(key, id)).data?.length ?? 0) > 0;
    expect(await seen(APPROVED)).toBe(a === 'admin' || a === 'staff');
    expect(await seen(DRAFT)).toBe(a === 'admin');
    expect(await seen(OTHER)).toBe(a === 'other-admin');
  });
  it.each(ACTORS)('%s insert', async (a) => {
    const title = `kn-ins-${table}-${a}`;
    const r = table === 'org_knowledge' ? row(ORG1, title, 'draft') : { knowledge_id: APPROVED, org_id: ORG1, version: 99, category: 'program', title, body: 'x', status: 'approved' };
    await clients[a].from(table).insert(r);
    expect(((await svc.from(table).select(key).eq('title', title)).data?.length ?? 0) > 0).toBe(table === 'org_knowledge' && a === 'admin');
  });
  it.each(ACTORS)('%s update', async (a) => {
    const { data } = await clients[a].from(table).update({ title: `kn-upd-${a}` }).eq(key, DRAFT).select(key);
    expect((data?.length ?? 0) > 0).toBe(table === 'org_knowledge' && a === 'admin');
    if (data?.length) await svc.from(table).update({ title: 'kn-draft' }).eq(key, DRAFT);
  });
  it.each(ACTORS)('%s delete is denied', async (a) => {
    await clients[a].from(table).delete().eq(key, DRAFT);
    expect((await svc.from(table).select(key).eq(key, DRAFT)).data?.length).toBeGreaterThan(0);
  });
});

describe('cross-org isolation', () => {
  it('admin cannot insert into or update another org', async () => {
    await clients.admin.from('org_knowledge').insert(row(ORG2, 'kn-cross'));
    expect((await svc.from('org_knowledge').select('id').eq('title', 'kn-cross')).data).toEqual([]);
    expect((await clients.admin.from('org_knowledge').update({ title: 'x' }).eq('id', OTHER).select('id')).data).toEqual([]);
    expect((await clients.admin.from('org_knowledge').update({ org_id: ORG2 }).eq('id', DRAFT).select('org_id')).data).toEqual([{ org_id: ORG1 }]);
  });
  it('listApproved and resolveCitation only see the caller org', async () => {
    const ids = (await listApproved(clients.staff)).map((r) => r.id);
    expect([APPROVED, DRAFT, OTHER].map((id) => ids.includes(id))).toEqual([true, false, false]);
    expect(await resolveCitation(clients.admin, sourceRef(OTHER, 1))).toBeNull();
    expect(await resolveCitation(clients['other-admin'], sourceRef(OTHER, 1))).toMatchObject({ id: OTHER, version: 1 });
    expect(await listApproved(clients.board_viewer)).toEqual([]);
  });
});

describe('versions, archive and citations', () => {
  it('edits bump the version, keep history, stamp the approver, and archived citations still resolve', async () => {
    const f = { category: 'outcome' as const, title: 'kn-ver', body: 'Seven in ten fictional families finished.', source: 'Synthetic report', as_of: '2025-12-31' };
    const v2 = { ...f, body: '8 of 10 fictional families finished.' };
    const ins = await saveKnowledge(clients.admin, { orgId: ORG1 }, { ...f, status: 'approved' });
    const id = ins.ok ? ins.row.id : '';
    expect(ins).toMatchObject({ ok: true, row: { version: 1, source_ref: sourceRef(id, 1) } });
    expect((await svc.from('org_knowledge').select('created_by,approved_by').eq('id', id).single()).data).toEqual({ created_by: ADMIN, approved_by: ADMIN });
    expect(await saveKnowledge(clients.admin, { id }, { ...v2, status: 'approved' })).toMatchObject({ ok: true, row: { version: 2 } });
    expect(await saveKnowledge(clients.admin, { id }, { ...f, body: 'jane.doe@example.com' })).toMatchObject({ ok: false, guard: { rules: ['email'] } });
    expect(await saveKnowledge(clients.admin, { id }, { ...v2, status: 'archived' })).toMatchObject({ ok: true, row: { version: 3 } });
    expect((await listApproved(clients.staff)).map((r) => r.id)).not.toContain(id);
    expect(await resolveCitation(clients.staff, sourceRef(id, 1))).toMatchObject({ body: f.body, version: 1 });
    expect(await resolveCitation(clients.staff, sourceRef(id, 2))).toMatchObject({ body: v2.body, version: 2 });
    expect(await resolveCitation(clients.staff, sourceRef(id, 3))).toBeNull();
    const { data: v } = await svc.from('org_knowledge_version').select('version,status').eq('knowledge_id', id).order('version');
    expect(v).toEqual([{ version: 1, status: 'approved' }, { version: 2, status: 'approved' }, { version: 3, status: 'archived' }]);
  });

  it('a no-op update does not add a version, and spoofed version/creator are ignored', async () => {
    const id = await make(row(ORG1, 'kn-noop', 'draft'));
    await clients.admin.from('org_knowledge').update({ title: 'kn-noop', version: 50, created_by: ADMIN }).eq('id', id);
    expect((await svc.from('org_knowledge').select('version,created_by').eq('id', id).single()).data).toEqual({ version: 1, created_by: null });
  });

  it.each([
    ['ssn', { body: 'Fictional SSN 078-05-1120' }], ['email', { body: 'write to a@example.com' }],
    ['numbers need source', { category: 'budget', body: 'Budget is $600,000.' }], ['length cap', { body: 'a'.repeat(8001) }],
  ])('database backstop rejects %s', async (_n, patch) => {
    expect((await svc.from('org_knowledge').insert({ ...row(ORG1, 'kn-bad'), ...patch })).error).toBeTruthy();
  });
});
