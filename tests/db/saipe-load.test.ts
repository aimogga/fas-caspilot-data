import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { COUNTIES } from '../../lib/synthetic/generate';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { Saipe } from '../../packages/ingest/saipe';

function need(name: string): string {
  if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`);
  return process.env[name] as string;
}

const API = need('SUPABASE_URL');
const SVC = need('SUPABASE_SERVICE_ROLE_KEY');
const DB = need('SUPABASE_DB_URL');
assertLocalSupabase(API, DB);
const CODES = Saipe.CODES;
const HDR = ['NAME', 'GEOID', 'SAEPOVALL_PT', 'SAEPOVALL_MOE', 'SAEPOVRTALL_PT', 'SAEPOVRTALL_MOE', 'SAEPOV0_17_PT', 'SAEPOV0_17_MOE', 'SAEPOVRT0_17_PT', 'SAEPOVRT0_17_MOE', 'YEAR', 'state', 'county'];

describe('integration: SAIPE load into local DB', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const table = [
    HDR,
    ...COUNTIES.map((c) => {
      const v = (x: string) => (c.fips === '49001' ? 'N/A' : x);
      return [c.name, c.fips, v('100'), v('1'), v('8.0'), v('0.1'), v('40'), v('2'), v('12.5'), v('0.3'), '2023', '49', c.fips.slice(2)];
    }),
  ];
  const rows = Saipe.requireComplete(Saipe.parse(table));
  const runIds: string[] = [];

  afterAll(async () => {
    await client.from('public_indicator').delete().in('indicator_code', [...CODES]);
    if (runIds.length) await client.from('ingest_run').delete().in('id', runIds);
  });

  it('loads all 29 counties with provenance and does not duplicate on re-run', async () => {
    const first = await PublicIndicatorIngest.load(client, Saipe.SOURCE_NAME, Saipe.checksum(rows), rows);
    const second = await PublicIndicatorIngest.load(client, Saipe.SOURCE_NAME, Saipe.checksum(rows), rows);
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
    expect(data!.filter((r) => r.geo_fips === '49001').every((r) => r.unit === Saipe.NOT_PUBLISHED)).toBe(true);
    expect(Number(data!.find((r) => r.geo_fips === '49035' && r.indicator_code === 'poverty_count')?.value)).toBe(100);
    expect(Number(data!.find((r) => r.geo_fips === '49035' && r.indicator_code === 'child_poverty_rate')?.value)).toBe(12.5);
  });
});
