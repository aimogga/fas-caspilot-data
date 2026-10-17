import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { fakeGenerate } from '../strategy/fake';
import type { StrategyDraft } from '../strategy/schema';
import { NOT_APPROVED } from './generate';
import { DOWNLOAD_ACTION, DOWNLOAD_TYPE, recordDownload, startOrOpen } from './handoff';

// F-508j. Synthetic rows and a fake chainable client; the writer runs on the e2e fake adapter, so no network call is made.
const OPP = '10101010-1010-1010-1010-101010101012', S = 'strategy-1';
const output: StrategyDraft = { opportunity_id: OPP, status: 'DRAFT', criteria_map: [{ criterion: 'Need for the project', fas_position: 'FAS pays for therapy.', evidence: [], gaps: [], confidence: 'medium' }],
  suggested_ask: null, risks: [], narrative_outline: [], inferences: [] };
const snapshot = { opportunity_id: OPP, built_at: '2026-10-16T00:00:00Z', facts: [], abstracts: [] };

function fakeClient(opts: { drafts?: { id: string; status: string; created_at: string }[]; status?: string; failJob?: boolean }) {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const result = (table: string) => (table === 'strategy_draft' ? { data: { id: S, org_id: 'org-1', opportunity_id: OPP, status: opts.status ?? 'approved', output, snapshot }, error: null } : { data: opts.drafts ?? [], error: null });
  const query = (table: string) => { const q = { eq: () => q, order: async () => result(table), single: async () => result(table) }; return q; };
  const client = { from: (table: string) => ({ select: () => query(table),
    insert: (row: Record<string, unknown>) => (inserts.push({ table, row }), {
      select: () => ({ single: async () => (table === 'export_job' && opts.failJob ? { data: null, error: { message: 'denied' } } : { data: { id: `${table}-1` }, error: null }) }),
      then: (ok: (v: unknown) => void) => ok({ error: null }) }) }) };
  return { client: client as unknown as SupabaseClient, inserts };
}

describe('strategy → application hand-off (F-508j)', () => {
  it('opens the newest existing draft instead of writing a duplicate', async () => {
    const { client, inserts } = fakeClient({ drafts: [{ id: 'a2', status: 'DRAFT', created_at: '2026-10-17' }, { id: 'a1', status: 'approved', created_at: '2026-10-16' }] });
    expect(await startOrOpen(client, S, fakeGenerate)).toEqual({ id: 'a2', opened: true });
    expect(inserts).toEqual([]);
  });

  it('refuses a strategy that is not approved, in plain words, and writes nothing', async () => {
    for (const status of ['DRAFT', 'rejected', 'failed']) {
      const { client, inserts } = fakeClient({ status });
      expect(await startOrOpen(client, S, fakeGenerate)).toEqual({ error: NOT_APPROVED });
      expect(inserts).toEqual([]);
    }
  });

  it('writes one DRAFT application from an approved strategy; the fake sections pass the writer checks', async () => {
    const { client, inserts } = fakeClient({});
    expect(await startOrOpen(client, S, fakeGenerate)).toEqual({ id: 'application_draft-1', opened: false });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ table: 'application_draft', row: { strategy_draft_id: S, status: 'DRAFT', validation_report: { ok: true, needs_edit: [] } } });
  });

  it('a download writes one export_job and one audit_log, and a failed job write throws for the route to log', async () => {
    const { client, inserts } = fakeClient({});
    await recordDownload(client, { id: 'a1', org_id: 'org-1', strategy_draft_id: S }, 'u1');
    expect(inserts).toEqual([
      { table: 'export_job', row: { org_id: 'org-1', type: DOWNLOAD_TYPE, params: { application_id: 'a1', strategy_draft_id: S, status: 'downloaded' }, suppression_applied: true, created_by: 'u1' } },
      { table: 'audit_log', row: { org_id: 'org-1', actor: 'u1', action: DOWNLOAD_ACTION, entity: 'export_job', entity_id: 'export_job-1', details: { application_id: 'a1', strategy_draft_id: S, status: 'downloaded' } } },
    ]);
    await expect(recordDownload(fakeClient({ failJob: true }).client, { id: 'a1', org_id: 'org-1', strategy_draft_id: S }, 'u1')).rejects.toThrow('denied');
  });
});
