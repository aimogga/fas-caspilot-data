import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IngestAlertPayload } from '../../packages/ingest/ingest-alert';
import { ProPublica, type FoundationRow } from '../../packages/ingest/propublica';
import { FUNDER_WATCHLIST, FoundationHistoryIngest, ProPublicaHttp, type ProPublicaRunOpts } from './propublica-http';
import type { RateLimiter } from './rate-limit';
const [search, org] = ['search', 'organization'].map((f) => readFileSync(`tests/fixtures/propublica/${f}.json`, 'utf8'));
/** Stub client: `opportunity` returns hand-entered funders; every other chain resolves to `{ data: [], error: null }`. */
const stubClient = (funders: (string | null)[]) => {
  const q: Record<string, unknown> = {}; for (const m of ['select', 'eq', 'in', 'not', 'order', 'limit']) q[m] = () => q;
  q.then = (res: (v: unknown) => void) => res({ data: funders.map((funder) => ({ funder })), error: null });
  return { from: () => q } as unknown as SupabaseClient;
};
const req = (token?: string, body?: string): Request => new Request('http://127.0.0.1/api/ingest/propublica', { method: 'POST', body, headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });
const fetchFixtures: typeof fetch = async (u) => new Response(String(u).includes('organizations/') ? org : search, { status: 200 });
afterEach(() => vi.restoreAllMocks()); describe('ProPublicaHttp', () => {
  it('rejects a missing or wrong token before running; 400 on a bad funders body; 200 with run id, funder count and notFound on success', async () => {
    const run = vi.fn().mockResolvedValue({ ingestRunId: 'r', rowsLoaded: 3, sourceId: 'x', funders: 2, notFound: ['Nobody'] }), env = { INGEST_TOKEN: 's' };
    const res = await Promise.all([req(), req('t'), req('s', '{"funders":"x"}'), req('s', '{"funders":["Example Family Foundation"]}')].map((r) => ProPublicaHttp.handle(r, { env, run })));
    expect([res.map((r) => r.status), run.mock.calls.length, run.mock.calls[0][0].funders, await res[3].json()]).toEqual([[401, 401, 400, 200], 1, ['Example Family Foundation'], { ok: true, ingestRunId: 'r', rowsLoaded: 3, funders: 2, notFound: ['Nobody'] }]);
  });
  it('merges the watchlist with foundation_manual/foundation_csv funders, dedupes case-insensitively, looks each up through the 30/min limiter and loads irs_990pf rows once per EIN', async () => {
    const client = stubClient(['Example Family Foundation', ' example family foundation ', 'Sample Community Trust', 'Hand Entered Trust', null]);
    expect(await FoundationHistoryIngest.funderList(client)).toEqual([...FUNDER_WATCHLIST, 'Hand Entered Trust']);
    expect(await FoundationHistoryIngest.funderList(client, ['10-0000001'])).toEqual(['10-0000001', 'Example Family Foundation', 'Sample Community Trust', 'Hand Entered Trust']);
    const calls: { name: string; checksum: string; rows: FoundationRow[] }[] = [], takes: number[] = [], limiter = { take: async () => { takes.push(1); } } as unknown as RateLimiter;
    const load = async (_c: SupabaseClient, name: string, checksum: string, rows: FoundationRow[]) => { calls.push({ name, checksum, rows }); return { ingestRunId: 'run-1', rowsLoaded: rows.length, sourceId: 's' }; };
    const res = await ProPublicaHttp.run({ env: {}, httpFetch: fetchFixtures, client, load, limiter, funders: ['10-0000001', 'Example Family Foundation', 'No Such Funder Anywhere'] });
    expect([res.rowsLoaded, res.funders, res.notFound, takes.length, calls[0].name, ProPublica.PER_MINUTE]).toEqual([3, 5, ['No Such Funder Anywhere', 'Sample Community Trust', 'Hand Entered Trust'], 9, 'propublica_990', 30]);
    expect([calls[0].checksum, calls[0].rows.every((r) => r.source === 'irs_990pf' && r.amount === null && r.recipient === null)]).toEqual([ProPublica.checksum(calls[0].rows), true]);
  });
  it('records a failed run and alerts exactly once on an upstream non-2xx without leaking secrets; 500 ingest failed', async () => {
    const [log, recordFailure, sent] = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.fn(async () => 'run-err'), [] as IngestAlertPayload[]], client = stubClient([]);
    const alertFetch: typeof fetch = async (_u, init) => { sent.push(JSON.parse(String(init?.body)) as IngestAlertPayload); return new Response(null, { status: 200 }); };
    const env = { INGEST_TOKEN: 'not-a-secret', INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook', SUPABASE_SERVICE_ROLE_KEY: 'dummy_secret_here' };
    const run = (o: ProPublicaRunOpts) => ProPublicaHttp.run({ ...o, recordFailure, limiter: { take: async () => {} } as unknown as RateLimiter });
    const res = await ProPublicaHttp.handle(req('not-a-secret'), { env, client, httpFetch: async () => new Response('x', { status: 503 }), run, alertFetch });
    expect([res.status, await res.json(), log.mock.calls.length]).toEqual([500, { error: 'ingest failed' }, 1]);
    expect(recordFailure).toHaveBeenCalledWith(client, 'propublica_990', expect.stringContaining('request failed: 503'));
    expect(sent).toEqual([expect.objectContaining({ source: 'propublica_990', status: 'error', ingestRunId: 'run-err' })]);
    const logged = JSON.stringify([log.mock.calls, sent]); expect([logged.includes('propublica_990'), logged.includes('not-a-secret'), logged.includes('dummy_secret_here')]).toEqual([true, false, false]);
  });
});
it('n8n workflow is inactive, quarterly, uses $env only, no literal URL', () => {
  const text = readFileSync('n8n/propublica-quarterly.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string; parameters: { rule?: { interval: { expression: string }[] } } }[] };
  expect([wf.active, wf.nodes[0].parameters.rule?.interval[0].expression, wf.nodes.map((n) => n.type).sort()]).toEqual([false, '0 14 3 1,4,7,10 *', ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.scheduleTrigger']]);
  expect([text.includes('$env.FAS_INGEST_PROPUBLICA_URL'), text.includes('$env.INGEST_TOKEN'), /20\d{2}|https?:\/\//.test(text)]).toEqual([true, true, false]);
});
