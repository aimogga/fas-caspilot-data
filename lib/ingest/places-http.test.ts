import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../synthetic/generate';
import type { IngestAlertPayload } from '../../packages/ingest/ingest-alert';
import type { IndicatorRow } from '../../packages/ingest/public-indicator';
import { CdcPlaces } from '../../packages/ingest/cdc_places';
import { PlacesHttp } from './places-http';

const rows = (year: string, counties = COUNTIES): unknown =>
  counties.flatMap((c) => ['MHLTH', 'DEPRESSION'].map((measureid) => ({
    year, locationid: c.fips, measureid, data_value: '12.0', low_confidence_limit: '11.0', high_confidence_limit: '13.0', data_value_type: CdcPlaces.VALUE_TYPE,
  })));
const ok = (body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), { status: 200 });
const client = {} as SupabaseClient;
const loaded: Array<{ name: string; checksum: string; rows: IndicatorRow[] }> = [];
const load = async (_c: SupabaseClient, name: string, checksum: string, rows: IndicatorRow[]) => {
  loaded.push({ name, checksum, rows });
  return { ingestRunId: 'run-1', rowsLoaded: rows.length, sourceId: 'src-1' };
};
const req = (token?: string, body?: string): Request =>
  new Request('http://127.0.0.1/api/ingest/places', { method: 'POST', headers: token === undefined ? {} : { authorization: `Bearer ${token}` }, body });

afterEach(() => { vi.restoreAllMocks(); loaded.length = 0; });

describe('PlacesHttp', () => {
  it('rejects a missing or wrong token before running; defaults to the latest release year and validates a requested one', async () => {
    const run = vi.fn();
    expect((await PlacesHttp.handle(req(), { env: { INGEST_TOKEN: 's' }, run })).status).toBe(401);
    expect((await PlacesHttp.handle(req('s'), { env: {}, run })).status).toBe(401);
    expect((await PlacesHttp.handle(req('t'), { env: { INGEST_TOKEN: 's' }, run })).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
    expect(PlacesHttp.year(new Date('2026-10-12T00:00:00Z'))).toBe('2025');
    expect(PlacesHttp.year(new Date('2026-01-07T15:00:00Z'), '2023')).toBe('2023');
    expect(() => PlacesHttp.year(new Date(), '24')).toThrow();
  });

  it('loads all 29 counties with source, checksum and year; the app token is optional', async () => {
    let requested = '';
    const httpFetch: typeof fetch = async (url) => { requested = String(url); return ok(rows('2023'))(url); };
    const res = await PlacesHttp.run({ year: '2023', env: {}, httpFetch, client, load });
    expect(res.rowsLoaded).toBe(58);
    expect([requested.includes('year%3D%272023%27'), requested.includes('app_token')]).toEqual([true, false]);
    expect(loaded[0]).toMatchObject({ name: CdcPlaces.SOURCE_NAME, checksum: CdcPlaces.checksum(loaded[0]!.rows) });
    expect(loaded[0]!.rows.every((r) => r.vintage === '2023')).toBe(true);
  });

  it('never loads an empty or unparseable payload', async () => {
    await expect(PlacesHttp.run({ year: '2023', env: {}, httpFetch: ok([]), client, load })).rejects.toThrow(/partial/);
    await expect(PlacesHttp.run({ year: '2023', env: {}, httpFetch: ok({ nope: 1 }), client, load })).rejects.toThrow(/not a JSON array/);
    expect(loaded).toHaveLength(0);
  });

  it('logs the caught error server-side without secrets and alerts with the error run id', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { INGEST_TOKEN: 'tok-secret', SOCRATA_APP_TOKEN: 'not-a-secret', INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook' };
    const recordFailure = vi.fn(async () => 'run-err');
    const sent: IngestAlertPayload[] = [];
    const alertFetch: typeof fetch = async (_u, init) => { sent.push(JSON.parse(String(init?.body)) as IngestAlertPayload); return new Response(null, { status: 200 }); };
    const run = (o: Parameters<typeof PlacesHttp.run>[0]) => PlacesHttp.run({ ...o, recordFailure, load });
    const res = await PlacesHttp.handle(req('tok-secret'), { env, client, httpFetch: async () => new Response('boom', { status: 500 }), run, alertFetch });
    expect([res.status, await res.json(), loaded.length]).toEqual([500, { error: 'ingest failed' }, 0]);
    expect(recordFailure).toHaveBeenCalledWith(client, CdcPlaces.SOURCE_NAME, 'PLACES fetch failed: 500');
    expect(sent).toEqual([expect.objectContaining({ source: CdcPlaces.SOURCE_NAME, status: 'error', ingestRunId: 'run-err' })]);
    const logged = JSON.stringify(log.mock.calls);
    for (const s of ['tok-secret', 'not-a-secret', 'app_token']) expect(logged).not.toContain(s);
  });
});

it('n8n workflow is inactive, yearly in January, uses $env only and has no hardcoded year', () => {
  const text = readFileSync('n8n/cdc-places.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.map((n) => n.type).sort()).toEqual(['n8n-nodes-base.httpRequest', 'n8n-nodes-base.scheduleTrigger']);
  for (const s of ['$env.FAS_INGEST_PLACES_URL', '$env.INGEST_TOKEN', '"0 15 7 1 *"']) expect(text).toContain(s);
  expect(text).not.toMatch(/20\d{2}|https?:\/\//);
});
