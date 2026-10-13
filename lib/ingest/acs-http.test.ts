import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Acs5 } from '../../packages/ingest/acs5';
import { AcsHttp } from './acs-http';
import { SahieHttp } from './sahie-http';

const fixture = JSON.parse(
  readFileSync('tests/fixtures/acs5/utah-counties.json', 'utf8'),
) as unknown;

describe('acs-http.ts', () => {
  describe('year', () => {
    it('computes year from now when not requested', () => {
      expect(AcsHttp.year(new Date('2026-10-13'))).toBe('2024');
      expect(AcsHttp.year(new Date('2026-11-01'))).toBe('2025');
    });

    it('delegates to SahieHttp.year when requested', () => {
      expect(AcsHttp.year(new Date('2026-10-13'), '2023')).toBe('2023');
    });
  });

  it('run fetches, parses, and loads', async () => {
    const load = vi.fn().mockResolvedValue({ ingestRunId: 'run-1', rowsLoaded: 87, sourceId: 'src-1' });
    const httpFetch = vi.fn(async () => new Response(JSON.stringify(fixture)));
    const result = await AcsHttp.run({
      year: '2023',
      env: { CENSUS_API_KEY: 'key' },
      httpFetch,
      client: createClient('http://x', 'key'),
      load,
    });
    expect(result.ingestRunId).toBe('run-1');
    expect(load).toHaveBeenCalledWith(expect.anything(), Acs5.SOURCE_NAME, expect.any(String), expect.arrayContaining([
      expect.objectContaining({ indicator_code: 'total_population', geo_fips: '49035', value: 1185000 }),
    ]));
  });

  it('logFailure redacts secrets', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const e = new Error('failed with key=secret123 and CENSUS_API_KEY=abc');
    AcsHttp.logFailure('test', e, { CENSUS_API_KEY: 'abc', INGEST_TOKEN: 'xyz' });
    expect(spy).toHaveBeenCalledWith('[ingest:acs]', expect.objectContaining({
      message: expect.stringContaining('[redacted]'),
    }));
    expect(spy.mock.calls[0][1].message).not.toContain('abc');
    expect(spy.mock.calls[0][1].message).not.toContain('secret123');
    spy.mockRestore();
  });

  it('handle reuses SahieHttp.tokenOk and returns 401', async () => {
    const req = new Request('http://x', { method: 'POST' });
    const res = await AcsHttp.handle(req, { env: { INGEST_TOKEN: 'secret' } });
    expect(res.status).toBe(401);
  });

  it('handle returns 200 on success', async () => {
    const run = vi.fn().mockResolvedValue({ ingestRunId: 'run-1', rowsLoaded: 87 });
    const req = new Request('http://x', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: JSON.stringify({ year: '2023' }),
    });
    const res = await AcsHttp.handle(req, { env: { INGEST_TOKEN: 'secret' }, run });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it('handle logs failure on bad JSON', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = new Request('http://x', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: 'not json',
    });
    const res = await AcsHttp.handle(req, { env: { INGEST_TOKEN: 'secret' } });
    expect(res.status).toBe(400);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('handle logs failure on ingest error', async () => {
    const failRun = vi.fn().mockRejectedValue(new Error('ingest failed'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = new Request('http://x', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: '',
    });
    const res = await AcsHttp.handle(req, { env: { INGEST_TOKEN: 'secret' }, run: failRun });
    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('reuses SahieHttp.tokenOk and readYear', () => {
    expect(SahieHttp.tokenOk).toBeDefined();
    expect(SahieHttp.readYear).toBeDefined();
    expect(SahieHttp.db).toBeDefined();
  });
});
