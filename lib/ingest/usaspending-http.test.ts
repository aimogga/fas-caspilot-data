import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IngestAlertPayload } from '../../packages/ingest/ingest-alert';
import { UsaSpending, type AwardRow } from '../../packages/ingest/usaspending';
import { UsaSpendingHttp } from './usaspending-http';
import type { RateLimiter } from './rate-limit';
import type { SahieRunOpts } from './sahie-http';
const fixture = readFileSync('tests/fixtures/usaspending/search.json', 'utf8'), client = {} as SupabaseClient;
type Call = { name: string; checksum: string; rows: AwardRow[] };
const req = (token?: string): Request => new Request('http://127.0.0.1/api/ingest/usaspending', { method: 'POST', headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });
afterEach(() => vi.restoreAllMocks());
describe('UsaSpendingHttp', () => {
  it('rejects a missing or wrong token before running; 200 with run id on success', async () => {
    const run = vi.fn().mockResolvedValue({ ingestRunId: 'r', rowsLoaded: 3, sourceId: 'x' }), statuses = await Promise.all([req(), req('t'), req('s')].map(async (r) => (await UsaSpendingHttp.handle(r, { env: { INGEST_TOKEN: 's' }, run })).status));
    expect([statuses, run.mock.calls.length]).toEqual([[401, 401, 200], 1]);
  });
  it('runs every default ALN × completed FY through the 30/min limiter and loads deduped rows with source and checksum', async () => {
    const [calls, takes] = [[] as Call[], [] as number[]], load = async (_c: SupabaseClient, name: string, checksum: string, rows: AwardRow[]) => { calls.push({ name, checksum, rows }); return { ingestRunId: 'run-1', rowsLoaded: rows.length, sourceId: 's' }; };
    const limiter = { take: async () => { takes.push(1); } } as unknown as RateLimiter;
    const res = await UsaSpendingHttp.run({ env: {}, now: new Date('2026-10-14T00:00:00Z'), httpFetch: async () => new Response(fixture, { status: 200 }), client, load, limiter });
    expect([res.rowsLoaded, takes.length, calls[0].name, UsaSpending.PER_MINUTE]).toEqual([3, 21, 'usaspending', 30]); // 7 ALNs × 3 FYs, one (hasNext=false) page each
    expect([calls[0].checksum, calls[0].rows.map((r) => r.external_id)]).toEqual([UsaSpending.checksum(calls[0].rows), ['ASST_NON_90CA1001_7501', 'ASST_NON_SM081002_7523', 'ASST_NON_90CA1003_7501']]);
  });
  it('records a failed run and alerts exactly once on an upstream non-2xx without leaking secrets; 500 ingest failed', async () => {
    const [log, recordFailure, sent] = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.fn(async () => 'run-err'), [] as IngestAlertPayload[]];
    const alertFetch: typeof fetch = async (_u, init) => { sent.push(JSON.parse(String(init?.body)) as IngestAlertPayload); return new Response(null, { status: 200 }); };
    const run = (o: SahieRunOpts) => UsaSpendingHttp.run({ ...o, load: undefined, recordFailure });
    const env = { INGEST_TOKEN: 'not-a-secret', INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook', SUPABASE_SERVICE_ROLE_KEY: 'dummy_secret_here' };
    const res = await UsaSpendingHttp.handle(req('not-a-secret'), { env, client, httpFetch: async () => new Response('x', { status: 503 }), run, alertFetch });
    expect([res.status, await res.json(), log.mock.calls.length]).toEqual([500, { error: 'ingest failed' }, 1]);
    expect(recordFailure).toHaveBeenCalledWith(client, 'usaspending', expect.stringContaining('search failed: 503'));
    expect(sent).toEqual([expect.objectContaining({ source: 'usaspending', status: 'error', ingestRunId: 'run-err' })]);
    const logged = JSON.stringify([log.mock.calls, sent]); expect([logged.includes('usaspending'), logged.includes('not-a-secret'), logged.includes('dummy_secret_here')]).toEqual([true, false, false]);
  });
});
it('n8n workflow is inactive, monthly, uses $env only, no literal URL', () => {
  const text = readFileSync('n8n/usaspending-monthly.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string; parameters: { rule?: { interval: { expression: string }[] } } }[] };
  expect([wf.active, wf.nodes[0].parameters.rule?.interval[0].expression, wf.nodes.map((n) => n.type).sort()]).toEqual([false, '0 14 2 * *', ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.scheduleTrigger']]);
  expect([text.includes('$env.FAS_INGEST_USASPENDING_URL'), text.includes('$env.INGEST_TOKEN'), /20\d{2}|https?:\/\//.test(text)]).toEqual([true, true, false]);
});
