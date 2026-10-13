import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Acs5 } from '../../packages/ingest/acs5';
import { AcsHttp } from './acs-http';

const fixture = JSON.parse(
  readFileSync('tests/fixtures/acs5/utah-counties.json', 'utf8'),
) as unknown;

describe('acs-http.ts', () => {
  describe('tokenOk', () => {
    it('accepts Bearer <INGEST_TOKEN>', () => {
      const req = new Request('http://x', {
        headers: { authorization: 'Bearer secret' },
      });
      expect(AcsHttp.tokenOk(req, { INGEST_TOKEN: 'secret' })).toBe(true);
    });

    it('rejects when INGEST_TOKEN is not set', () => {
      const req = new Request('http://x', {
        headers: { authorization: 'Bearer secret' },
      });
      expect(AcsHttp.tokenOk(req, {})).toBe(false);
    });

    it('rejects when authorization header is missing', () => {
      const req = new Request('http://x');
      expect(AcsHttp.tokenOk(req, { INGEST_TOKEN: 'secret' })).toBe(false);
    });

    it('rejects when token does not match', () => {
      const req = new Request('http://x', {
        headers: { authorization: 'Bearer wrong' },
      });
      expect(AcsHttp.tokenOk(req, { INGEST_TOKEN: 'secret' })).toBe(false);
    });
  });

  describe('year', () => {
    it('returns requested year when valid', () => {
      expect(AcsHttp.year(new Date('2026-10-13'), '2023')).toBe('2023');
    });

    it('computes year from now when not requested', () => {
      expect(AcsHttp.year(new Date('2026-10-13'))).toBe('2024');
      expect(AcsHttp.year(new Date('2026-11-01'))).toBe('2025');
    });

    it('throws when year is not YYYY', () => {
      expect(() => AcsHttp.year(new Date(), 'abc')).toThrow('year must be YYYY');
    });
  });

  describe('readYear', () => {
    it('reads year from body', () => {
      expect(AcsHttp.readYear({ year: '2023' })).toBe('2023');
    });

    it('returns undefined when year is not present', () => {
      expect(AcsHttp.readYear({})).toBeUndefined();
      expect(AcsHttp.readYear(null)).toBeUndefined();
    });

    it('throws when body is not an object', () => {
      expect(() => AcsHttp.readYear('string')).toThrow('body');
      expect(() => AcsHttp.readYear([])).toThrow('body');
    });

    it('throws when year is not a string YYYY', () => {
      expect(() => AcsHttp.readYear({ year: 2023 })).toThrow('year');
      expect(() => AcsHttp.readYear({ year: 'abc' })).toThrow('year');
    });
  });

  describe('run', () => {
    const load = vi.fn();
    const httpFetch = vi.fn(async () => new Response(JSON.stringify(fixture)));
    const client = createClient('http://x', 'key');

    beforeAll(() => {
      load.mockResolvedValue({ ingestRunId: 'run-1', rowsLoaded: 87, sourceId: 'src-1' });
    });

    it('fetches, parses, and loads', async () => {
      const result = await AcsHttp.run({
        year: '2023',
        env: { CENSUS_API_KEY: 'key' },
        httpFetch,
        client,
        load,
      });
      expect(result.ingestRunId).toBe('run-1');
      expect(result.rowsLoaded).toBe(87);
      expect(load).toHaveBeenCalledWith(
        client,
        Acs5.SOURCE_NAME,
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({
            indicator_code: 'total_population',
            geo_fips: '49035',
            value: 1185000,
          }),
        ]),
      );
    });
  });

  describe('handle', () => {
    const run = vi.fn();

    beforeAll(() => {
      run.mockResolvedValue({ ingestRunId: 'run-1', rowsLoaded: 87, sourceId: 'src-1' });
    });

    it('returns 401 when token is invalid', async () => {
      const req = new Request('http://x', { method: 'POST' });
      const res = await AcsHttp.handle(req, { env: { INGEST_TOKEN: 'secret' } });
      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('unauthorized');
    });

    it('returns 200 on success', async () => {
      const req = new Request('http://x', {
        method: 'POST',
        headers: { authorization: 'Bearer secret' },
        body: JSON.stringify({ year: '2023' }),
      });
      const res = await AcsHttp.handle(req, { env: { INGEST_TOKEN: 'secret' }, run });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { ok: boolean; ingestRunId: string; rowsLoaded: number };
      expect(json.ok).toBe(true);
      expect(json.ingestRunId).toBe('run-1');
      expect(json.rowsLoaded).toBe(87);
    });

    it('returns 400 on bad JSON', async () => {
      const req = new Request('http://x', {
        method: 'POST',
        headers: { authorization: 'Bearer secret' },
        body: 'not json',
      });
      const res = await AcsHttp.handle(req, { env: { INGEST_TOKEN: 'secret' }, run });
      expect(res.status).toBe(400);
    });

    it('returns 500 on ingest failure', async () => {
      const failRun = vi.fn().mockRejectedValue(new Error('ingest failed'));
      const req = new Request('http://x', {
        method: 'POST',
        headers: { authorization: 'Bearer secret' },
        body: '',
      });
      const res = await AcsHttp.handle(req, { env: { INGEST_TOKEN: 'secret' }, run: failRun });
      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('ingest failed');
    });
  });
});
