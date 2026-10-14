import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IngestAlertPayload } from '../../packages/ingest/ingest-alert';
import type { IndicatorRow } from '../../packages/ingest/public-indicator';
import { UtCourts } from '../../packages/ingest/ut_courts';
import { buildXlsx } from '../../tests/fixtures/ut_courts/build';
import { UtCourtsHttp } from './ut-courts-http';

const fixture = readFileSync('tests/fixtures/ut_courts/filings.xlsx');
const ok = (body: BodyInit | null, status = 200): typeof fetch => async () => new Response(body, { status });
const client = {} as SupabaseClient;
const loads: Array<{ name: string; checksum: string; rows: IndicatorRow[] }> = [];
const load = async (_c: SupabaseClient, name: string, checksum: string, rows: IndicatorRow[]) =>
  (loads.push({ name, checksum, rows }), { ingestRunId: 'run-1', rowsLoaded: rows.length, sourceId: 'src-1' });
const req = (token?: string) => new Request('http://127.0.0.1/api/ingest/ut-courts', { method: 'POST', headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });

afterEach(() => vi.restoreAllMocks());

describe('UtCourtsHttp', () => {
  it('rejects a missing or wrong token before running', async () => {
    const run = vi.fn();
    const cases = [[undefined, { INGEST_TOKEN: 'not-a-secret' }], ['not-a-secret', {}], ['t', { INGEST_TOKEN: 'not-a-secret' }]] as const;
    for (const [token, env] of cases) expect((await UtCourtsHttp.handle(req(token), { env, run })).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('loads 2 fiscal years × 29 counties × 4 codes with source, pinned checksum and FY vintages', async () => {
    const res = await UtCourtsHttp.run({ env: {}, httpFetch: ok(fixture), client, load });
    expect(res.rowsLoaded).toBe(232);
    expect([loads[0].name, loads[0].checksum]).toEqual([UtCourts.SOURCE_NAME, UtCourts.checksum(loads[0].rows)]);
    expect(loads[0].checksum).toBe('9e613bf910ece6fd5b136045d765a4af0cea6d0fca696301702683319441eccc');
    expect(new Set(loads[0].rows.map((r) => r.vintage))).toEqual(new Set(['FY2025', 'FY2026']));
  });

  it('never loads a non-2xx, unparseable or rejected payload; records the failed run and alerts with its id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loads.length = 0;
    const recordFailure = vi.fn(async () => 'run-err');
    const sent: IngestAlertPayload[] = [];
    const env = { INGEST_TOKEN: 'not-a-secret', INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook' };
    const wrong = Buffer.from(buildXlsx({ All: [['Year', 'County', 'Filings']] }));
    for (const [body, status, re] of [[null, 406, /fetch failed: 406/], [wrong, 200, /unknown columns/], ['not a zip', 200, /./]] as const) {
      await expect(UtCourtsHttp.run({ env, httpFetch: ok(body, status), client, load, recordFailure })).rejects.toThrow(re);
    }
    const partial = Buffer.from(buildXlsx({ All: [['Fiscal Year', 'County', 'Court Type', 'Filing Count'], [2026, 'Beaver', 'District', 3]] }));
    const res = await UtCourtsHttp.handle(req('not-a-secret'), {
      env, client, httpFetch: ok(partial), run: (o) => UtCourtsHttp.run({ ...o, recordFailure, load }),
      alertFetch: async (_url, init) => (sent.push(JSON.parse(String(init?.body)) as IngestAlertPayload), new Response(null, { status: 200 })),
    });
    expect([res.status, loads.length, recordFailure.mock.calls.length]).toEqual([500, 0, 4]);
    expect(sent).toEqual([expect.objectContaining({ source: UtCourts.SOURCE_NAME, status: 'error', ingestRunId: 'run-err' })]);
    expect(sent[0].error).toMatch(/FY2026: only 1 of 29 counties published/);
  });
});

it('n8n workflow is inactive, uses $env only and has no hardcoded year or URL', () => {
  const text = readFileSync('n8n/ut-courts-annual.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.map((n) => n.type)).toEqual(['n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.httpRequest']);
  expect(text).toContain('$env.FAS_INGEST_UT_COURTS_URL');
  expect(text).toContain('$env.INGEST_TOKEN');
  expect(text).not.toMatch(/20\d{2}|https?:\/\//);
});
