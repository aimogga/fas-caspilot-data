import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IngestAlertPayload } from '../../packages/ingest/ingest-alert';
import { GrantsGov, type OpportunityRow } from '../../packages/ingest/grants_gov';
import { GrantsGovHttp } from './grants-gov-http';
import type { RateLimiter } from './rate-limit';
import type { SahieRunOpts } from './sahie-http';

const fixture = JSON.parse(readFileSync('tests/fixtures/grants_gov/search.json', 'utf8')) as unknown;
const client = {} as SupabaseClient;
type Call = { name: string; checksum: string; rows: OpportunityRow[] };
const spyLoad = (calls: Call[] = []) => ({ calls, load: async (_c: SupabaseClient, name: string, checksum: string, rows: OpportunityRow[]) => {
  calls.push({ name, checksum, rows }); return { ingestRunId: 'run-1', rowsLoaded: rows.length, sourceId: 'src-1' }; } });
const req = (token?: string): Request =>
  new Request('http://127.0.0.1/api/ingest/grants-gov', { method: 'POST', headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });
/** Drives handle() through the real run with a stubbed failure recorder and alert sink; returns what left the process. */
const failing = async (env: Record<string, string>, httpFetch: typeof fetch) => {
  const [log, recordFailure, sent] = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.fn(async () => 'run-err'), [] as IngestAlertPayload[]];
  const alertFetch: typeof fetch = async (_u, init) => { sent.push(JSON.parse(String(init?.body)) as IngestAlertPayload); return new Response(null, { status: 200 }); };
  const run = (o: SahieRunOpts) => GrantsGovHttp.run({ ...o, load: undefined, recordFailure });
  const res = await GrantsGovHttp.handle(req('not-a-secret'), { env: { INGEST_TOKEN: 'not-a-secret', INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook', ...env }, client, httpFetch, run, alertFetch });
  return { status: res.status, body: await res.json(), recordFailure, sent, logged: JSON.stringify([log.mock.calls, sent]), logs: log.mock.calls.length };
};
afterEach(() => vi.restoreAllMocks());
describe('GrantsGovHttp', () => {
  it('rejects a missing or wrong token before running; 200 with run id on success', async () => {
    const run = vi.fn().mockResolvedValue({ ingestRunId: 'r', rowsLoaded: 2, sourceId: 'x' });
    const statuses = await Promise.all([req(), req('t'), req('s')].map(async (r) => (await GrantsGovHttp.handle(r, { env: { INGEST_TOKEN: 's' }, run })).status));
    expect([statuses, run.mock.calls.length]).toEqual([[401, 401, 200], 1]);
  });
  it('runs every default theme through the limiter and loads deduped rows with source and checksum', async () => {
    const [spy, takes] = [spyLoad(), [] as number[]];
    const limiter = { take: async () => { takes.push(1); } } as unknown as RateLimiter;
    const httpFetch: typeof fetch = async () => new Response(JSON.stringify(fixture), { status: 200 });
    const res = await GrantsGovHttp.run({ env: { SIMPLER_GRANTS_API_KEY: 'not-a-secret' }, httpFetch, client, load: spy.load, limiter });
    expect([res.rowsLoaded, takes.length, spy.calls[0].name]).toEqual([2, 4, 'grants_gov']); // 4 default themes, one (short) page each
    expect(spy.calls[0].checksum).toBe(GrantsGov.checksum(spy.calls[0].rows));
    expect(spy.calls[0].rows.map((r) => r.external_id)).toEqual(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']);
  });
  it('503 "api key not configured" when the key env is missing: no upstream call, failed run recorded, exactly one alert', async () => {
    const httpFetch = vi.fn<typeof fetch>();
    const r = await failing({}, httpFetch);
    expect([r.status, r.body, r.logs, httpFetch.mock.calls.length]).toEqual([503, { error: 'api key not configured' }, 1, 0]);
    expect(r.recordFailure).toHaveBeenCalledWith(client, 'grants_gov', 'api key not configured');
    expect(r.sent).toEqual([expect.objectContaining({ source: 'grants_gov', status: 'error', ingestRunId: 'run-err' })]);
  });
  it('records a failed run and alerts on an upstream non-2xx without leaking the key; 500 ingest failed', async () => {
    const r = await failing({ SIMPLER_GRANTS_API_KEY: 'dummy_secret_here', SUPABASE_SERVICE_ROLE_KEY: 'dummy_secret_here' }, async () => new Response('x', { status: 403 }));
    expect([r.status, r.body]).toEqual([500, { error: 'ingest failed' }]);
    expect(r.recordFailure).toHaveBeenCalledWith(client, 'grants_gov', expect.stringContaining('search failed: 403'));
    expect(r.sent).toEqual([expect.objectContaining({ source: 'grants_gov', status: 'error', ingestRunId: 'run-err' })]);
    expect(r.logged).toContain('grants_gov');
    for (const s of ['not-a-secret', 'dummy_secret_here']) expect(r.logged).not.toContain(s);
  });
});
it('n8n workflow is inactive, weekly (keeps the key active within 30 days), uses $env only, no literal URL', () => {
  const text = readFileSync('n8n/grants-gov-weekly.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string; parameters: { rule?: { interval: { expression: string }[] } } }[] };
  expect([wf.active, wf.nodes[0].parameters.rule?.interval[0].expression, wf.nodes.map((n) => n.type).sort()]).toEqual([false, '0 13 * * 1', ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.scheduleTrigger']]);
  expect([text.includes('$env.FAS_INGEST_GRANTS_GOV_URL'), text.includes('$env.INGEST_TOKEN'), /20\d{2}|https?:\/\//.test(text)]).toEqual([true, true, false]);
});
