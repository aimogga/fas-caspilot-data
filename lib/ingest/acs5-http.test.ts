import { afterEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../synthetic/generate';
import type { IndicatorRow } from '../../packages/ingest/public-indicator';
import { Acs5 } from '../../packages/ingest/acs5';
import { Acs5Http } from './acs5-http';

const ENV = { INGEST_TOKEN: 'tok', CENSUS_API_KEY: 'sekret-key' };
const HDR = ['NAME', ...Acs5.VARIABLES, 'state', 'county'];
const body = (n = 29) => [HDR, ...COUNTIES.slice(0, n).map((c) => ['n', '100', '-555555555', '2.5', '0.1', '9', '3', '49', c.fips.slice(2)])];
const fetchOf = (json: unknown, status = 200) => async () => new Response(JSON.stringify(json), { status });
const req = (auth?: string, text = '') =>
  new Request('http://127.0.0.1/api/ingest/acs5', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: text });
const client = {} as SupabaseClient;

afterEach(() => vi.restoreAllMocks());

it('defaults to the latest released 5-year vintage', () => {
  expect(Acs5Http.year(new Date('2026-10-12T00:00:00Z'))).toBe('2024');
  expect(Acs5Http.year(new Date('2027-01-10T00:00:00Z'))).toBe('2024');
  expect(() => Acs5Http.year(new Date(), '24')).toThrow();
});

it('run loads 87 rows once under census-acs with a checksum', async () => {
  const calls: Array<[string, string, IndicatorRow[]]> = [];
  const load = async (_c: SupabaseClient, name: string, sum: string, rows: IndicatorRow[]) => {
    calls.push([name, sum, rows]);
    return { ingestRunId: 'r1', rowsLoaded: rows.length, sourceId: 's' };
  };
  const out = await Acs5Http.run({ year: '2024', env: ENV, httpFetch: fetchOf(body()), client, load });
  expect(out.rowsLoaded).toBe(87);
  expect(calls).toHaveLength(1);
  expect(calls[0][0]).toBe('census-acs');
  expect(calls[0][1]).toMatch(/^[0-9a-f]{64}$/);
  expect(calls[0][2].every((r) => r.vintage === '2024')).toBe(true);
});

it('never loads a partial response', async () => {
  const load = vi.fn();
  await expect(Acs5Http.run({ year: '2024', env: ENV, httpFetch: fetchOf(body(28)), client, load })).rejects.toThrow(/partial/);
  expect(load).not.toHaveBeenCalled();
});

it('POST rejects missing, wrong or unconfigured tokens and bad bodies', async () => {
  expect((await Acs5Http.handle(req(), { env: ENV })).status).toBe(401);
  expect((await Acs5Http.handle(req('Bearer nope'), { env: ENV })).status).toBe(401);
  expect((await Acs5Http.handle(req('Bearer tok'), { env: { CENSUS_API_KEY: 'x' } })).status).toBe(401);
  expect((await Acs5Http.handle(req('Bearer tok', '{"year":24}'), { env: ENV })).status).toBe(400);
});

it('POST returns run provenance on success', async () => {
  const run = async () => ({ ingestRunId: 'r9', rowsLoaded: 87, sourceId: 's' });
  const res = await Acs5Http.handle(req('Bearer tok', '{"year":"2024"}'), { env: ENV, run });
  expect(await res.json()).toEqual({ ok: true, ingestRunId: 'r9', rowsLoaded: 87 });
});

it('POST logs the failure stage server-side without secrets (#96)', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const run = async () => {
    throw Object.assign(new Error('boom sekret-key tok https://x?key=abc'), { stage: 'load' });
  };
  const res = await Acs5Http.handle(req('Bearer tok'), { env: ENV, run });
  expect(res.status).toBe(500);
  expect(await res.text()).not.toContain('boom');
  expect(spy).toHaveBeenCalledTimes(1);
  const logged = JSON.stringify(spy.mock.calls[0]);
  expect(logged).toContain('"stage":"load"');
  expect(logged).toContain('census-acs');
  expect(logged).not.toMatch(/sekret-key|tok |key=abc/);
});
