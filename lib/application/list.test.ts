import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { countWords, LIST_LIMIT, listApplications, monthOf } from './list';

// F-508k. Synthetic rows and a fake chainable client that records each call.
type Drafts = { id: string; opportunity_id: string; status: string; approved_at: string | null; created_at: string }[];
function fakeClient(drafts: Drafts, opps: { id: string; title: string; funder: string | null }[], fail?: 'drafts' | 'opps') {
  const calls: string[] = [];
  const client = { from: (table: string) => ({ select: (cols: string) => {
    calls.push(`${table}:${cols}`);
    if (table === 'application_draft') return { order: (col: string, o: { ascending: boolean }) => (calls.push(`order ${col} ${o.ascending}`), {
      limit: async (n: number) => (calls.push(`limit ${n}`), fail === 'drafts' ? { data: null, error: { message: 'denied' } } : { data: drafts, error: null }) }) };
    return { in: async (_c: string, ids: string[]) => (calls.push(`in ${ids.join(',')}`), fail === 'opps' ? { data: null, error: { message: 'down' } } : { data: opps.filter((o) => ids.includes(o.id)), error: null }) };
  } }) };
  return { client: client as unknown as SupabaseClient, calls };
}
const draft = (id: string, opportunity_id: string, status: string, created_at: string, approved_at: string | null = null) => ({ id, opportunity_id, status, approved_at, created_at });

describe('F-508k application list', () => {
  it('lists drafts newest first (as the query orders them) with title, funder and month-only dates; one opportunity read for all rows', async () => {
    const { client, calls } = fakeClient(
      [draft('a3', 'o1', 'DRAFT', '2026-10-17T09:00:00Z'), draft('a2', 'o2', 'approved', '2026-09-30T23:30:00Z', '2026-10-02T08:00:00Z'), draft('a1', 'o1', 'archived', '2026-08-01T00:00:00Z')],
      [{ id: 'o1', title: 'Family Strengthening Grants', funder: 'Example Foundation' }, { id: 'o2', title: 'Court Improvement Program', funder: null }]);
    expect(await listApplications(client)).toEqual([
      { id: 'a3', status: 'DRAFT', title: 'Family Strengthening Grants', funder: 'Example Foundation', started: 'Oct 2026', approved: null },
      { id: 'a2', status: 'approved', title: 'Court Improvement Program', funder: null, started: 'Sep 2026', approved: 'Oct 2026' },
      { id: 'a1', status: 'archived', title: 'Family Strengthening Grants', funder: 'Example Foundation', started: 'Aug 2026', approved: null },
    ]);
    expect(calls).toEqual(['application_draft:id,opportunity_id,status,approved_at,created_at', 'order created_at false', `limit ${LIST_LIMIT}`, 'opportunity:id,title,funder', 'in o1,o2']);
  });

  it('names a draft whose grant is not visible "Grant application"; no rows means no opportunity read', async () => {
    expect((await listApplications(fakeClient([draft('a1', 'gone', 'DRAFT', '2026-10-17T00:00:00Z')], []).client))[0]).toMatchObject({ title: 'Grant application', funder: null });
    const empty = fakeClient([], []);
    expect([await listApplications(empty.client), empty.calls.some((c) => c.startsWith('opportunity'))]).toEqual([[], false]);
  });

  it('throws on a read error so the page shows its error state', async () => {
    await expect(listApplications(fakeClient([], [], 'drafts').client)).rejects.toThrow('denied');
    await expect(listApplications(fakeClient([draft('a1', 'o1', 'DRAFT', '2026-10-17T00:00:00Z')], [], 'opps').client)).rejects.toThrow('down');
  });

  it('count line and month words', () => {
    expect(countWords([{ status: 'DRAFT' }, { status: 'approved' }, { status: 'archived' }, { status: 'archived' }])).toBe('1 draft · 1 approved · 2 archived');
    expect(countWords([])).toBe('0 drafts · 0 approved · 0 archived');
    expect(monthOf('2026-12-31T23:59:59Z')).toBe('Dec 2026');
  });
});
