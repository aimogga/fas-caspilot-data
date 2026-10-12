import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { COUNTIES } from '../../lib/synthetic/generate';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { Sahie } from '../../packages/ingest/sahie';

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing ${name}. Run pnpm test:db`);
  }
  return v;
}

const API = need('SUPABASE_URL');
const SVC = need('SUPABASE_SERVICE_ROLE_KEY');
const DB = need('SUPABASE_DB_URL');
assertLocalSupabase(API, DB);

const fixture = JSON.parse(readFileSync('tests/fixtures/sahie/utah-counties.json', 'utf8')) as unknown;
const CODES = ['uninsured_count', 'uninsured_rate'] as const;

describe('integration: SAHIE load into local DB', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = Sahie.coverUtah(Sahie.parse(fixture));
  const checksum = Sahie.checksum(rows);
  const runIds: string[] = [];

  afterAll(async () => {
    await client.from('public_indicator').delete().in('indicator_code', [...CODES]);
    if (runIds.length) {
      await client.from('ingest_run').delete().in('id', runIds);
    }
  });

  it('loads all 29 counties with provenance and does not duplicate on re-run', async () => {
    const first = await PublicIndicatorIngest.load(client, Sahie.SOURCE_NAME, checksum, rows);
    const second = await PublicIndicatorIngest.load(client, Sahie.SOURCE_NAME, checksum, rows);
    runIds.push(first.ingestRunId, second.ingestRunId);
    expect(first.rowsLoaded).toBe(COUNTIES.length * 2);
    expect(second.rowsLoaded).toBe(COUNTIES.length * 2);
    const { data, error } = await client
      .from('public_indicator')
      .select('geo_fips,indicator_code,value,unit,vintage,source_id,ingest_run_id')
      .in('indicator_code', [...CODES]);
    expect(error).toBeNull();
    expect(data).toHaveLength(COUNTIES.length * 2);
    expect(new Set(data!.map((r) => r.geo_fips))).toEqual(new Set(COUNTIES.map((c) => c.fips)));
    expect(data!.every((r) => r.source_id === first.sourceId && r.vintage === '2023')).toBe(true);
    expect(data!.every((r) => r.ingest_run_id === second.ingestRunId)).toBe(true);
    const daggett = data!.filter((r) => r.geo_fips === '49009');
    expect(daggett).toHaveLength(2);
    expect(daggett.every((r) => r.unit === Sahie.NOT_PUBLISHED && r.value == null)).toBe(true);
    const slc = data!.find((r) => r.geo_fips === '49035' && r.indicator_code === 'uninsured_count');
    expect(Number(slc?.value)).toBe(95000);
    expect(slc?.unit).toBe('count');
  });
});
