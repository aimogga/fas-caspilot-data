import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { COUNTIES } from '../../lib/synthetic/generate';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { Acs5 } from '../../packages/ingest/acs5';

function need(name: string): string {
  if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`);
  return process.env[name] as string;
}

const API = need('SUPABASE_URL');
const SVC = need('SUPABASE_SERVICE_ROLE_KEY');
const DB = need('SUPABASE_DB_URL');
assertLocalSupabase(API, DB);
const CODES = Acs5.CODES;
const HDR = ['NAME', 'B01003_001E', 'B11001_001E', 'B21001_002E', 'B11003_010E', 'B11003_016E', 'B08201_002E', 'state', 'county'];

describe('integration: ACS load into local DB', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const table = [
    HDR,
    ...COUNTIES.map((c) => {
      const v = (x: string) => (c.fips === '49001' ? 'N/A' : x);
      return [`n${c.fips}`, v('100000'), v('30000'), v('5000'), v('450'), v('1500'), v('1200'), '49', c.fips.slice(2)];
    }),
  ];
  const rows = Acs5.requireComplete(Acs5.parse(table), '2023');
  const runIds: string[] = [];

  afterAll(async () => {
    await client.from('public_indicator').delete().in('indicator_code', [...CODES]);
    if (runIds.length) await client.from('ingest_run').delete().in('id', runIds);
  });

  it('loads all 29 counties with provenance and does not duplicate on re-run', async () => {
    const first = await PublicIndicatorIngest.load(client, Acs5.SOURCE_NAME, Acs5.checksum(rows), rows);
    const second = await PublicIndicatorIngest.load(client, Acs5.SOURCE_NAME, Acs5.checksum(rows), rows);
    runIds.push(first.ingestRunId, second.ingestRunId);
    const { data, error } = await client
      .from('public_indicator')
      .select('geo_fips,indicator_code,value,unit,vintage,source_id,ingest_run_id')
      .in('indicator_code', [...CODES]);
    expect(error).toBeNull();
    expect(data).toHaveLength(COUNTIES.length * CODES.length);
    expect(new Set(data!.map((r) => r.geo_fips))).toEqual(new Set(COUNTIES.map((c) => c.fips)));
    expect(data!.every((r) => r.source_id === first.sourceId && r.vintage === '2023')).toBe(true);
    expect(data!.every((r) => r.ingest_run_id === second.ingestRunId)).toBe(true);
    expect(data!.filter((r) => r.geo_fips === '49001').every((r) => r.unit === 'not_published')).toBe(true);
    expect(Number(data!.find((r) => r.geo_fips === '49035' && r.indicator_code === 'total_population')?.value)).toBe(100000);
    expect(Number(data!.find((r) => r.geo_fips === '49035' && r.indicator_code === 'single_parent_pct')?.value)).toBe(6.5);
  });
});
