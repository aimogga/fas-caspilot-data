import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../synthetic/generate';
import type { IngestAlertPayload } from '../../packages/ingest/ingest-alert';
import type { IndicatorRow } from '../../packages/ingest/public-indicator';
import { VaVetpop } from '../../packages/ingest/va_vetpop';
import { VetpopHttp } from './vetpop-http';

const table = (year: string, counties = COUNTIES): unknown =>
  counties.map((c) => ({ state: 'UT', county: `${c.name} County`, fips: c.fips, fiscal_year: year, veterans: '1499' }));
const ok = (body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), { status: 200 });
const client = {} as SupabaseClient;

type Call = { name: string; checksum: string; rows: IndicatorRow[] };
const spyLoad = (calls: Call[] = []) => ({ calls, load: async (_c: SupabaseClient, name: string, checksum: string, rows: IndicatorRow[]) => {
  calls.push({ name, checksum, rows });
  return { ingestRunId: 'run-1', rowsLoaded: rows.length, sourceId: 'src-1' };
} });

const req = (token?: string, body?: string): Request =>
  new Request('http://127.0.0.1/api/ingest/vetpop', { method: 'POST', headers: token === undefined ? {} : { authorization: `Bearer ${token}` }, body });

afterEach(() => vi.restoreAllMocks());

describe('VetpopHttp', () => {
  it('rejects a missing or wrong token before running', async () => {
    const run = vi.fn();
    expect((await VetpopHttp.handle(req(), { env: { INGEST_TOKEN: 's' }, run })).status).toBe(401);
    expect((await VetpopHttp.handle(req('s'), { env: {}, run })).status).toBe(401);
    expect((await VetpopHttp.handle(req('t'), { env: { INGEST_TOKEN: 's' }, run })).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
    run.mockResolvedValue({ ingestRunId: 'r', rowsLoaded: 29, sourceId: 'x' });
    expect(await (await VetpopHttp.handle(req('s', '{"year":"2023"}'), { env: { INGEST_TOKEN: 's' }, run })).json()).toEqual({ ok: true, ingestRunId: 'r', rowsLoaded: 29 });
    expect(run.mock.calls[0]?.[0].year).toBe('2023');
  });

  it('loads all 29 counties with source, checksum and the dataset year; no year means no year filter', async () => {
    const spy = spyLoad();
    let requested = '';
    const httpFetch: typeof fetch = async (url) => { requested = String(url); return ok(table('2023'))(url); };
    expect((await VetpopHttp.run({ env: {}, httpFetch, client, load: spy.load })).rowsLoaded).toBe(29);
    expect(requested).not.toContain('fiscal_year');
    expect(spy.calls[0].name).toBe(VaVetpop.SOURCE_NAME);
    expect(spy.calls[0].checksum).toBe(VaVetpop.checksum(spy.calls[0].rows));
    expect(spy.calls[0].rows.every((r) => r.vintage === '2023' && r.value === 1000)).toBe(true);
    await VetpopHttp.run({ year: '2023', env: {}, httpFetch, client, load: spy.load });
    expect(decodeURIComponent(requested)).toContain("fiscal_year='2023'");
    await expect(VetpopHttp.run({ year: '23', env: {}, httpFetch, client, load: spy.load })).rejects.toThrow(/YYYY/);
  });

  it('pins the checksum and never loads a partial or unparseable payload', async () => {
    expect(VaVetpop.checksum(VaVetpop.requireComplete(VaVetpop.parse(table('2023'))))).toBe('9d113a347567b64fac3e52afe8397ffc10c6683c4fb7f356396acbb4335db1cb');
    const spy = spyLoad();
    const short = VaVetpop.parse(table('2023', COUNTIES.slice(1)));
    expect(short.rows.find((r) => r.geo_fips === '49001')?.unit).toBe(VaVetpop.NOT_PUBLISHED);
    await expect(VetpopHttp.run({ env: {}, httpFetch: ok({ nope: 1 }), client, load: spy.load })).rejects.toThrow(/JSON array/);
    await expect(VetpopHttp.run({ env: {}, httpFetch: ok([{ x: 1 }]), client, load: spy.load })).rejects.toThrow(/unknown columns x/);
    expect(spy.calls).toHaveLength(0);
  });

  it('logs the caught error server-side without secrets and alerts with the error run id', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { INGEST_TOKEN: 'not-a-secret', SOCRATA_APP_TOKEN: 'not-a-secret', SUPABASE_SERVICE_ROLE_KEY: 'dummy_secret_here', INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook' };
    const recordFailure = vi.fn(async () => 'run-err');
    const sent: IngestAlertPayload[] = [];
    const res = await VetpopHttp.handle(req('not-a-secret'), {
      env, client, httpFetch: async () => new Response('x', { status: 500 }),
      run: (o) => VetpopHttp.run({ ...o, recordFailure }),
      alertFetch: async (_url, init) => { sent.push(JSON.parse(String(init?.body)) as IngestAlertPayload); return new Response(null, { status: 200 }); },
    });
    expect([res.status, await res.json()]).toEqual([500, { error: 'ingest failed' }]);
    expect(recordFailure).toHaveBeenCalledWith(client, VaVetpop.SOURCE_NAME, expect.stringContaining('fetch failed: 500'));
    expect(sent).toEqual([expect.objectContaining({ source: VaVetpop.SOURCE_NAME, status: 'error', ingestRunId: 'run-err' })]);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain('va-vetpop');
    for (const s of ['not-a-secret', 'dummy_secret_here', 'data.va.gov']) expect(logged).not.toContain(s);
  });
});

it('n8n workflow is inactive, uses $env only and has no hardcoded year', () => {
  const text = readFileSync('n8n/va-vetpop.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.map((n) => n.type).sort()).toEqual(['n8n-nodes-base.httpRequest', 'n8n-nodes-base.scheduleTrigger']);
  expect(text).toContain('$env.FAS_INGEST_VETPOP_URL');
  expect(text).toContain('$env.INGEST_TOKEN');
  expect(text).not.toMatch(/20\d{2}|https?:\/\//);
});
