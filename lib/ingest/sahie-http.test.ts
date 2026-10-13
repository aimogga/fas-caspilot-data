import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../synthetic/generate';
import type { IndicatorRow } from '../../packages/ingest/public-indicator';
import { Sahie } from '../../packages/ingest/sahie';
import { SahieHttp } from './sahie-http';

const HDR = [
  'NAME', 'GEOID', 'NUI_PT', 'NUI_MOE', 'PCTUI_PT', 'PCTUI_MOE', 'YEAR',
  'AGECAT', 'SEXCAT', 'RACECAT', 'IPRCAT', 'state', 'county',
];

function table(year: string, counties = COUNTIES): unknown {
  return [
    HDR,
    ...counties.map((c) => [
      c.name, c.fips, '100', '1', '8.0', '0.1', year, '0', '0', '0', '0', '49', c.fips.slice(2),
    ]),
  ];
}

function spyLoad() {
  const calls: Array<{ name: string; checksum: string; rows: IndicatorRow[] }> = [];
  const load = async (
    _client: SupabaseClient,
    name: string,
    checksum: string,
    rows: IndicatorRow[],
  ) => {
    calls.push({ name, checksum, rows });
    return { ingestRunId: 'run-1', rowsLoaded: rows.length, sourceId: 'src-1' };
  };
  return { calls, load };
}

function req(token?: string, body?: string): Request {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return new Request('http://127.0.0.1/api/ingest/sahie', {
    method: 'POST',
    headers,
    body,
  });
}

describe('SahieHttp auth fails closed', () => {
  it('rejects a missing token, a missing secret, and a mismatch', async () => {
    const env = { INGEST_TOKEN: 'secret' };
    expect(SahieHttp.tokenOk(req(), env)).toBe(false);
    expect(SahieHttp.tokenOk(req('secret'), {})).toBe(false);
    expect(SahieHttp.tokenOk(req('secret'), { INGEST_TOKEN: '' })).toBe(false);
    expect(SahieHttp.tokenOk(req('other'), env)).toBe(false);
    expect(SahieHttp.tokenOk(req('secret'), env)).toBe(true);
    const lower = new Request('http://127.0.0.1/api/ingest/sahie', {
      method: 'POST',
      headers: { authorization: 'bearer secret' },
    });
    expect(SahieHttp.tokenOk(lower, env)).toBe(false);
    const denied = await SahieHttp.handle(req('other'), { env });
    expect(denied.status).toBe(401);
  });
});

describe('SahieHttp year is not hardcoded', () => {
  it('uses the request year or the SAHIE release lag', () => {
    expect(SahieHttp.year(new Date('2026-09-01T00:00:00Z'))).toBe('2024');
    expect(SahieHttp.year(new Date('2026-03-01T00:00:00Z'))).toBe('2023');
    expect(SahieHttp.year(new Date('2026-09-01T00:00:00Z'), '2022')).toBe('2022');
    expect(() => SahieHttp.year(new Date('2026-09-01T00:00:00Z'), '22')).toThrow(/YYYY/);
  });
});

it('pins the SAHIE checksum for a fixed synthetic table', () => {
  const rows = Sahie.requireComplete(Sahie.parse(table('2023')));
  expect(Sahie.checksum(rows)).toBe('8da167378b32966aba48451f3f4bc45405fe8ae46373ae8864e0ff4833656f22');
});

describe('SahieHttp.run reuses Sahie fetch, parse, fill, and load', () => {
  it('loads the complete Utah set and passes source, checksum, and year', async () => {
    const year = '2023';
    const spy = spyLoad();
    const result = await SahieHttp.run({
      year,
      env: { CENSUS_API_KEY: 'x' },
      httpFetch: async (url) => {
        expect(String(url)).toContain('time=2023');
        expect(String(url)).not.toContain('CENSUS_API_KEY');
        return new Response(JSON.stringify(table(year)), { status: 200 });
      },
      client: {} as SupabaseClient,
      load: spy.load,
    });
    expect(result.ingestRunId).toBe('run-1');
    expect(result.rowsLoaded).toBe(COUNTIES.length * 2);
    expect(spy.calls).toHaveLength(1);
    const call = spy.calls[0];
    expect(call?.name).toBe(Sahie.SOURCE_NAME);
    expect(call?.checksum).toBe(Sahie.checksum(call?.rows ?? []));
    expect(call?.rows.every((row) => row.vintage === year && row.period === year)).toBe(true);
  });

  it('does not call load when 28 counties come back', async () => {
    const spy = spyLoad();
    const year = '2023';
    const partial = table(year, COUNTIES.slice(0, 28));
    await expect(
      SahieHttp.run({
        year,
        env: { CENSUS_API_KEY: 'x' },
        httpFetch: async () => new Response(JSON.stringify(partial), { status: 200 }),
        client: {} as SupabaseClient,
        load: spy.load,
      }),
    ).rejects.toThrow(/partial/);
    expect(spy.calls).toEqual([]);
  });

  it('does not call load when the payload is not a table', async () => {
    const spy = spyLoad();
    await expect(
      SahieHttp.run({
        year: '2023',
        env: { CENSUS_API_KEY: 'x' },
        httpFetch: async () => new Response('{}', { status: 200 }),
        client: {} as SupabaseClient,
        load: spy.load,
      }),
    ).rejects.toThrow(/census table/);
    expect(spy.calls).toEqual([]);
  });

  it('does not call load when the payload is not JSON', async () => {
    const spy = spyLoad();
    await expect(
      SahieHttp.run({
        year: '2023',
        env: { CENSUS_API_KEY: 'x' },
        httpFetch: async () => new Response('not-json', { status: 200 }),
        client: {} as SupabaseClient,
        load: spy.load,
      }),
    ).rejects.toThrow();
    expect(spy.calls).toEqual([]);
  });

  it('does not need CENSUS_API_KEY when the key is missing', async () => {
    const spy = spyLoad();
    await expect(
      SahieHttp.run({
        year: '2023',
        env: {},
        httpFetch: async () => new Response('[]'),
        client: {} as SupabaseClient,
        load: spy.load,
      }),
    ).rejects.toThrow('CENSUS_API_KEY is not set');
    expect(spy.calls).toEqual([]);
  });
});

describe('POST /api/ingest/sahie', () => {
  it('returns 200 for a valid token and does not leak the Census key', async () => {
    const leak = 'not-a-secret';
    const env = { INGEST_TOKEN: 'secret', CENSUS_API_KEY: leak };
    const res = await SahieHttp.handle(req('secret'), {
      env,
      run: async () => ({ ingestRunId: 'run-1', rowsLoaded: 58, sourceId: 'src-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; ingestRunId: string; rowsLoaded: number };
    expect(body).toEqual({ ok: true, ingestRunId: 'run-1', rowsLoaded: 58 });
    expect(JSON.stringify(body)).not.toContain(leak);
  });

  it('returns 500 without leaking env values when run fails', async () => {
    const leak = 'not-a-secret';
    const env = { INGEST_TOKEN: 'secret', CENSUS_API_KEY: leak };
    const res = await SahieHttp.handle(req('secret'), {
      env,
      run: async () => {
        throw new Error(`CENSUS_API_KEY ${leak}`);
      },
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe(JSON.stringify({ error: 'ingest failed' }));
    expect(text).not.toContain(leak);
    expect(text).not.toContain('CENSUS_API_KEY');
  });

  it('returns 400 for a bad year and 401 when the secret is unset', async () => {
    const bad = await SahieHttp.handle(req('secret', '{"year":"22"}'), {
      env: { INGEST_TOKEN: 'secret' },
    });
    expect(bad.status).toBe(400);
    const open = await SahieHttp.handle(req('secret'), { env: {} });
    expect(open.status).toBe(401);
  });
});

it('n8n posts to FAS_INGEST_SAHIE_URL with no hardcoded year', () => {
  const text = readFileSync('n8n/census-sahie.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.some((n) => n.type === 'n8n-nodes-base.httpRequest')).toBe(true);
  expect(text).toContain('$env.FAS_INGEST_SAHIE_URL');
  expect(text).toContain('$env.INGEST_TOKEN');
  expect(text).not.toMatch(/20\d{2}/);
  expect(text).not.toContain('CENSUS_API_KEY');
});

describe('SahieHttp.payload', () => {
  it('redacts key= query params even when the key is not in env', () => {
    const p = SahieHttp.payload('acs5', new Error('GET https://api.census.gov/x?get=a&key=abc123&for=county failed'), {});
    expect(p.error).toContain('key=[redacted]');
    expect(p.error).not.toContain('abc123');
  });
});
