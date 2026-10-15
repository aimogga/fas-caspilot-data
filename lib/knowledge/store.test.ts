import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { listApproved, parseSourceRef, resolveCitation, saveKnowledge, sourceRef } from './store';

const ID = 'f5080000-0000-4000-a000-000000000001';
const REF = `org_knowledge:${ID}@v2`;
const ROW = { id: ID, category: 'mission', title: 'Mission', body: 'We fund therapy.', source: null, as_of: null, version: 2 };

/** Records the PostgREST chain and resolves with `result` wherever it is awaited. */
function fake(data: unknown, error: { message: string } | null = null) {
  const calls: unknown[][] = [];
  const chain: Record<string, unknown> = { then: (ok: (v: unknown) => unknown) => Promise.resolve({ data, error }).then(ok) };
  for (const m of ['from', 'select', 'eq', 'in', 'order', 'insert', 'update', 'maybeSingle']) chain[m] = (...a: unknown[]) => (calls.push([m, ...a]), chain);
  return { client: chain as unknown as SupabaseClient, calls };
}

describe('source_ref', () => {
  it('formats and parses org_knowledge:<id>@v<version>', () => {
    expect(sourceRef(ID, 2)).toBe(REF);
    expect(parseSourceRef(REF)).toEqual({ id: ID, version: 2 });
  });
  it.each([`org_knowledge:${ID}`, `org_knowledge:${ID}@v0`, `org_knowledge:${ID}@v-1`, `public_indicator:${ID}@v1`, 'org_knowledge:x@v1', `${REF} `])(
    'rejects %s', (ref) => expect(parseSourceRef(ref)).toBeNull());
});

describe('reads', () => {
  it('listApproved filters status and categories and adds source_ref', async () => {
    const { client, calls } = fake([ROW]);
    expect(await listApproved(client, { categories: ['mission'] })).toEqual([{ ...ROW, source_ref: REF }]);
    expect(calls).toEqual(expect.arrayContaining([['from', 'org_knowledge'], ['eq', 'status', 'approved'], ['in', 'category', ['mission']]]));
    await expect(listApproved(fake(null, { message: 'boom' }).client)).rejects.toThrow('boom');
  });
  it('resolveCitation reads the exact approved snapshot', async () => {
    const { client, calls } = fake({ knowledge_id: ID, category: 'mission', title: 'Mission', body: 'We fund therapy.', source: null, as_of: null, version: 2 });
    expect(await resolveCitation(client, REF)).toEqual({ ...ROW, source_ref: REF });
    expect(calls).toEqual(expect.arrayContaining([['from', 'org_knowledge_version'], ['eq', 'knowledge_id', ID], ['eq', 'version', 2], ['eq', 'status', 'approved']]));
    expect(await resolveCitation(fake(null).client, REF)).toBeNull();
    const bad = fake(ROW);
    expect([await resolveCitation(bad.client, 'org_knowledge:nope'), bad.calls]).toEqual([null, []]);
  });
});

describe('saveKnowledge', () => {
  it('runs the guard before any write, then inserts with the org id or updates by id, and returns the source_ref', async () => {
    const bad = fake(null);
    expect(await saveKnowledge(bad.client, { orgId: ID }, { category: 'other', title: 't', body: 'SSN 078-05-1120' })).toMatchObject({ ok: false, guard: { rules: ['ssn'] } });
    expect(bad.calls).toEqual([]);
    const f = { category: 'mission' as const, title: 'Mission', body: 'We fund therapy.' }, ins = fake(ROW);
    expect(await saveKnowledge(ins.client, { orgId: 'org' }, f)).toEqual({ ok: true, row: { ...ROW, source_ref: REF } });
    expect(ins.calls).toContainEqual(['insert', { org_id: 'org', ...f }]);
    const upd = fake(null);
    expect(await saveKnowledge(upd.client, { id: ID }, f)).toEqual({ ok: false, error: 'Not saved: row not found or not editable.' });
    expect(upd.calls).toEqual(expect.arrayContaining([['update', f], ['eq', 'id', ID]]));
  });
});
