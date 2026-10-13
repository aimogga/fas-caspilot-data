import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../synthetic/generate';
import type { IngestAlertPayload } from '../../packages/ingest/ingest-alert';
import type { IndicatorRow } from '../../packages/ingest/public-indicator';
import { Saipe } from '../../packages/ingest/saipe';
import { SaipeHttp } from './saipe-http';

const HDR = ['NAME', 'GEOID', 'SAEPOVALL_PT', 'SAEPOVALL_MOE', 'SAEPOVRTALL_PT', 'SAEPOVRTALL_MOE', 'YEAR', 'state', 'county'];
const table = (year: string, counties = COUNTIES): unknown =>
  [HDR, ...counties.map((c) => [c.name, c.fips, '100', '1', '8.0', '0.1', year, '49', c.fips.slice(2)])];
const ok = (body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), { status: 200 });
const client = {} as SupabaseClient;

function spyLoad() {
  const calls: Array<{ name: string; checksum: string; rows: IndicatorRow[] }> = [];
  const load = async (_c: SupabaseClient, name: string, checksum: string, rows: IndicatorRow[]) => {
    calls.push({ name, checksum, rows });
    return { ingestRunId: 'run-1', rowsLoaded: rows.length, sourceId: 'src-1' };
  };
  return { calls, load };
}

const req = (token?: string, body?: string): Request =>
  new Request('http://127.0.0.1/api/ingest/saipe', { method: 'POST', headers: token === undefined ? {} : { authorization: `Bearer ${token}` }, body });

afterEach(() => vi.restoreAllMocks());

describe('SaipeHttp', () => {
  it('rejects a missing or wrong token before running', async () => {
    const run = vi.fn();
    expect((await SaipeHttp.handle(req(), { env: { INGEST_TOKEN: 's' }, run })).status).toBe(401);
    expect((await SaipeHttp.handle(req('s'), { env: {}, run })).status).toBe(401);
    expect((await SaipeHttp.handle(req('t'), { env: { INGEST_TOKEN: 's' }, run })).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('defaults to the latest published year and validates a requested one', () => {
    expect(SaipeHttp.year(new Date('2026-10-12T00:00:00Z'))).toBe('2024');
    expect(SaipeHttp.year(new Date('2026-12-15T00:00:00Z'))).toBe('2025');
    expect(() => SaipeHttp.year(new Date(), '24')).toThrow();
  });

  it('loads all 29 counties with source, checksum and year', async () => {
    const spy = spyLoad();
    const res = await SaipeHttp.run({ year: '2023', env: { CENSUS_API_KEY: 'k' }, httpFetch: ok(table('2023')), client, load: spy.load });
    expect(res.rowsLoaded).toBe(58);
    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0].name).toBe(Saipe.SOURCE_NAME);
    expect(spy.calls[0].checksum).toBe(Saipe.checksum(spy.calls[0].rows));
    expect(spy.calls[0].rows.every((r) => r.vintage === '2023')).toBe(true);
  });

  it('pins the checksum and fails closed on mixed years', () => {
    expect(Saipe.checksum(Saipe.requireComplete(Saipe.parse(table('2023'))))).toBe('7c66748bd8ca528f9ae6ad4998dd83902cea806b9c0419c769a767694b9c41c8');
    const mixed = table('2023') as string[][];
    mixed[29]![6] = '2022';
    expect(() => Saipe.requireComplete(Saipe.parse(mixed))).toThrow(/mixed vintages/);
  });

  it('never loads a partial or unparseable payload', async () => {
    const spy = spyLoad();
    const env = { CENSUS_API_KEY: 'k' };
    await expect(SaipeHttp.run({ year: '2023', env, httpFetch: ok(table('2023', COUNTIES.slice(1))), client, load: spy.load })).rejects.toThrow(/partial/);
    await expect(SaipeHttp.run({ year: '2023', env, httpFetch: ok({ nope: 1 }), client, load: spy.load })).rejects.toThrow();
    expect(spy.calls).toHaveLength(0);
  });

  it('returns 200 on success and 400 on a bad body', async () => {
    const env = { INGEST_TOKEN: 's' };
    const run = vi.fn<typeof SaipeHttp.run>(async () => ({ ingestRunId: 'r', rowsLoaded: 58, sourceId: 'x' }));
    const good = await SaipeHttp.handle(req('s', '{"year":"2023"}'), { env, run });
    expect(await good.json()).toEqual({ ok: true, ingestRunId: 'r', rowsLoaded: 58 });
    expect(run.mock.calls[0]?.[0].year).toBe('2023');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await SaipeHttp.handle(req('s', '{"year":5}'), { env, run })).status).toBe(400);
  });

  it('logs the caught error server-side without secrets (#96)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { INGEST_TOKEN: 'tok-secret', CENSUS_API_KEY: 'cen-key-1', SUPABASE_SERVICE_ROLE_KEY: 'dummy_secret_here' };
    const run = vi.fn(async () => {
      throw new Error('boom cen-key-1 dummy_secret_here tok-secret https://x?key=cen-key-1');
    });
    const res = await SaipeHttp.handle(req('tok-secret'), { env, run });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'ingest failed' });
    expect(log).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(log.mock.calls[0]);
    expect(logged).toContain('census-saipe');
    expect(logged).toContain('"stage":"run"');
    expect(logged).toContain('boom');
    for (const s of ['tok-secret', 'cen-key-1', 'dummy_secret_here']) expect(logged).not.toContain(s);
  });

  it('fetch failure records an error run and alerts with its id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { INGEST_TOKEN: 's', CENSUS_API_KEY: 'cen-key-1', INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook' };
    const recordFailure = vi.fn(async () => 'run-err');
    const spy = spyLoad();
    const sent: IngestAlertPayload[] = [];
    const res = await SaipeHttp.handle(req('s'), {
      env,
      client,
      httpFetch: ok({ nope: 1 }),
      run: (o) => SaipeHttp.run({ ...o, recordFailure, load: spy.load }),
      alertFetch: async (_url, init) => {
        sent.push(JSON.parse(String(init?.body)) as IngestAlertPayload);
        return new Response(null, { status: 200 });
      },
    });
    expect(res.status).toBe(500);
    expect(spy.calls).toHaveLength(0);
    expect(recordFailure).toHaveBeenCalledWith(client, Saipe.SOURCE_NAME, expect.any(String));
    expect(sent).toEqual([expect.objectContaining({ source: Saipe.SOURCE_NAME, status: 'error', ingestRunId: 'run-err' })]);
  });
});

it('n8n workflow is inactive, uses $env only and has no hardcoded year', () => {
  const text = readFileSync('n8n/census-saipe.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger')).toBe(true);
  expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.httpRequest')).toBe(true);
  expect(text).toContain('$env.FAS_INGEST_SAIPE_URL');
  expect(text).toContain('$env.INGEST_TOKEN');
  expect(text).not.toMatch(/20\d{2}|https?:\/\//);
});
