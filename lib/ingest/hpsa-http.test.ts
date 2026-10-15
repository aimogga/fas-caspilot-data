import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IngestAlertPayload } from '../../packages/ingest/ingest-alert';
import type { IndicatorRow } from '../../packages/ingest/public-indicator';
import { HrsaHpsaMh } from '../../packages/ingest/hrsa_hpsa_mh';
import { HpsaHttp } from './hpsa-http';

const fixture = readFileSync('tests/fixtures/hrsa_hpsa_mh/utah.csv', 'utf8');
const ok = (body: string, status = 200): typeof fetch => async () => new Response(body, { status });
const client = {} as SupabaseClient;
const loads: Array<{ name: string; checksum: string; rows: IndicatorRow[] }> = [];
const load = async (_c: SupabaseClient, name: string, checksum: string, rows: IndicatorRow[]) => {
  loads.push({ name, checksum, rows });
  return { ingestRunId: 'run-1', rowsLoaded: rows.length, sourceId: 'src-1' };
};
const req = (token?: string): Request =>
  new Request('http://127.0.0.1/api/ingest/hpsa', { method: 'POST', headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });

afterEach(() => vi.restoreAllMocks());

describe('HpsaHttp', () => {
  it('rejects a missing or wrong token before running', async () => {
    const run = vi.fn();
    const cases = [[undefined, { INGEST_TOKEN: 'not-a-secret' }], ['not-a-secret', {}], ['t', { INGEST_TOKEN: 'not-a-secret' }]] as const;
    for (const [token, env] of cases) expect((await HpsaHttp.handle(req(token), { env, run })).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('loads all 29 counties × 3 codes with source, pinned checksum and run-date vintage', async () => {
    const res = await HpsaHttp.run({ now: new Date('2026-10-13T12:00:00Z'), env: {}, httpFetch: ok(fixture), client, load });
    expect(res.rowsLoaded).toBe(87);
    expect([loads[0].name, loads[0].checksum]).toEqual([HrsaHpsaMh.SOURCE_NAME, HrsaHpsaMh.checksum(loads[0].rows)]);
    expect(loads[0].checksum).toBe('970291f24a43ee0c9181f0155046c63d90ed276e64e43b3382fba95dbb9f19af');
    expect(loads[0].rows.every((r) => r.vintage === '2026-10-13')).toBe(true);
  });

  it('never loads a non-2xx, unparseable or rejected payload; records the failed run and alerts with its id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loads.length = 0;
    const recordFailure = vi.fn(async () => 'run-err');
    const sent: IngestAlertPayload[] = [];
    const env = { INGEST_TOKEN: 'not-a-secret', INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook' };
    for (const [body, status, re] of [['', 403, /fetch failed: 403/], ['Foo,Bar\n1,2', 200, /unknown columns/]] as const) {
      await expect(HpsaHttp.run({ env, httpFetch: ok(body, status), client, load, recordFailure })).rejects.toThrow(re);
    }
    const res = await HpsaHttp.handle(req('not-a-secret'), {
      env, client, httpFetch: ok('HPSA Status,Common State County FIPS Code,HPSA Score\nDesignated,49035,99'),
      run: (o) => HpsaHttp.run({ ...o, recordFailure, load }),
      alertFetch: async (_url, init) => (sent.push(JSON.parse(String(init?.body)) as IngestAlertPayload), new Response(null, { status: 200 })),
    });
    expect([res.status, loads.length, recordFailure.mock.calls.length]).toEqual([500, 0, 3]);
    expect(sent).toEqual([expect.objectContaining({ source: HrsaHpsaMh.SOURCE_NAME, status: 'error', ingestRunId: 'run-err' })]);
  });
});

it('n8n workflow is inactive, calls the production URL with the n8n credential, no $env or hardcoded year', () => {
  const text = readFileSync('n8n/hrsa-hpsa-mh.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.map((n) => n.type)).toEqual(['n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.httpRequest']);
  expect(text).toContain('https://fas-caspilot-data.vercel.app/api/ingest/hpsa');
  expect(text).toContain('"httpHeaderAuth":{"id":"hJd3gjSOX9o2ITvB","name":"FAS ingest token"}');
  expect(text).not.toMatch(/20\d{2}|\$env\./);
});
