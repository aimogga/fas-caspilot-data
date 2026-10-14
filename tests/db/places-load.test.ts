import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { COUNTIES } from '../../lib/synthetic/generate';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { CdcPlaces } from '../../packages/ingest/cdc_places';

const need = (name: string): string => process.env[name] ?? ((): never => { throw new Error(`Missing ${name}. Run pnpm test:db`); })();

const [API, SVC, DB] = [need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), need('SUPABASE_DB_URL')];
assertLocalSupabase(API, DB);
const CODES = ['mental_distress_rate', 'depression_rate'] as const;

describe('integration: PLACES load into local DB', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const fixture = JSON.parse(readFileSync('tests/fixtures/cdc_places/utah-counties.json', 'utf8')) as unknown;
  const rows = CdcPlaces.requireComplete(CdcPlaces.fill(CdcPlaces.parse(fixture)));
  const runIds: string[] = [];

  afterAll(async () => {
    await client.from('public_indicator').delete().in('indicator_code', [...CODES]);
    if (runIds.length) await client.from('ingest_run').delete().in('id', runIds);
  });

  it('loads all 29 counties with provenance and does not duplicate on re-run', async () => {
    const first = await PublicIndicatorIngest.load(client, CdcPlaces.SOURCE_NAME, CdcPlaces.checksum(rows), rows);
    const second = await PublicIndicatorIngest.load(client, CdcPlaces.SOURCE_NAME, CdcPlaces.checksum(rows), rows);
    runIds.push(first.ingestRunId, second.ingestRunId);
    const { data, error } = await client.from('public_indicator')
      .select('geo_fips,indicator_code,value,moe,unit,vintage,source_id,ingest_run_id').in('indicator_code', [...CODES]);
    expect(error).toBeNull();
    expect(data).toHaveLength(COUNTIES.length * 2);
    expect(new Set(data!.map((r) => r.geo_fips))).toEqual(new Set(COUNTIES.map((c) => c.fips)));
    expect(data!.every((r) => r.source_id === first.sourceId && r.vintage === '2023')).toBe(true);
    expect(data!.every((r) => r.ingest_run_id === second.ingestRunId)).toBe(true);
    expect(data!.filter((r) => r.unit === CdcPlaces.NOT_PUBLISHED).map((r) => `${r.geo_fips}:${r.indicator_code}`).sort())
      .toEqual(['49009:depression_rate', '49031:mental_distress_rate']);
    expect(Number(data!.find((r) => r.geo_fips === '49001' && r.indicator_code === 'mental_distress_rate')?.value)).toBe(12.3);
  });
});
