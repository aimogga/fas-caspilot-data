import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
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

    it('falls back one year when primary year fails', async () => {
      const load = vi.fn().mockResolvedValue({ ingestRunId: 'run-1', rowsLoaded: 87, sourceId: 'src-1' });
      let calls = 0;
      const urls: URL[] = [];
      const mock = vi.fn(async (url: URL) => {
        urls.push(url);
        calls++;
        if (calls === 1) throw new Error('404');
        return new Response(JSON.stringify(fixture));
      });
      await AcsHttp.run({ year: '2025', env: { CENSUS_API_KEY: 'key' }, httpFetch: mock as typeof fetch, client: createClient('http://x', 'key'), load });
      expect(mock).toHaveBeenCalledTimes(2);
      expect(String(urls[0])).toContain('/2025/');
      expect(String(urls[1])).toContain('/2024/');
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

  it('run does not call load on incomplete or rejected payload', async () => {
    const load = vi.fn();
    const partial = [['NAME', 'B01003_001E', 'B11001_001E', 'B21001_002E', 'state', 'county'], ['n49035', '100000', '30000', '5000', '49', '035']];
    await expect(AcsHttp.run({ year: '2023', env: { CENSUS_API_KEY: 'key' }, httpFetch: async () => new Response(JSON.stringify(partial)), client: createClient('http://x', 'key'), load })).rejects.toThrow(/partial/);
    expect(load).not.toHaveBeenCalled();
    const rejected = [['NAME', 'B01003_001E', 'B11001_001E', 'B21001_002E', 'state', 'county'], ['n49035', 'invalid', '30000', '5000', '49', '035']];
    await expect(AcsHttp.run({ year: '2023', env: { CENSUS_API_KEY: 'key' }, httpFetch: async () => new Response(JSON.stringify(rejected)), client: createClient('http://x', 'key'), load })).rejects.toThrow(/rejected/);
    expect(load).toHaveBeenCalledTimes(0);
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

  it('handle: 401 no auth, 200 success, 400 bad JSON, 500 ingest error', async () => {
    expect((await AcsHttp.handle(new Request('http://x', { method: 'POST' }), { env: { INGEST_TOKEN: 's' } })).status).toBe(401);
    const run = vi.fn().mockResolvedValue({ ingestRunId: 'run-1', rowsLoaded: 87 });
    const ok = await AcsHttp.handle(new Request('http://x', { method: 'POST', headers: { authorization: 'Bearer s' }, body: JSON.stringify({ year: '2023' }) }), { env: { INGEST_TOKEN: 's' }, run });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { ok: boolean }).ok).toBe(true);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await AcsHttp.handle(new Request('http://x', { method: 'POST', headers: { authorization: 'Bearer s' }, body: 'bad' }), { env: { INGEST_TOKEN: 's' } })).status).toBe(400);
    const failRun = vi.fn().mockRejectedValue(new Error('ingest failed'));
    expect((await AcsHttp.handle(new Request('http://x', { method: 'POST', headers: { authorization: 'Bearer s' }, body: '' }), { env: { INGEST_TOKEN: 's' }, run: failRun })).status).toBe(500);
    spy.mockRestore();
  });

  it('reuses SahieHttp.tokenOk and readYear', () => {
    expect(SahieHttp.tokenOk).toBeDefined();
    expect(SahieHttp.readYear).toBeDefined();
    expect(SahieHttp.db).toBeDefined();
  });
});
