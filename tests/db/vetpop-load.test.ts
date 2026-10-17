import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { COUNTIES } from '../../lib/synthetic/generate';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { VaVetpop } from '../../packages/ingest/va_vetpop';

const need = (name: string): string => {
  if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`);
  return process.env[name] as string;
};
const [API, SVC, DB] = [need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), need('SUPABASE_DB_URL')];
assertLocalSupabase(API, DB);

describe('integration: VetPop load into local DB', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  // Beaver (49001) is absent from the payload and must load as an explicit not_published row.
  // Live jrjd-qghv shape (#209): each county is split into age × sex cells that the parser sums.
  const payload = COUNTIES.filter((c) => c.fips !== '49001').flatMap((c) => [['Male', c.fips === '49035' ? '40000' : '1250'], ['Female', c.fips === '49035' ? '21234' : '1250']]
    .map(([sex, veterans]) => ({ date: '2023-09-30T00:00:00.000', fips: c.fips, county_state: `${c.name}, UT`, state: 'Utah', age_group: '45 to 64', sex, veterans })));
  const rows = VaVetpop.requireComplete(VaVetpop.parse(payload));
  const runIds: string[] = [];

  afterAll(async () => {
    await client.from('public_indicator').delete().eq('indicator_code', 'veterans_count');
    if (runIds.length) await client.from('ingest_run').delete().in('id', runIds);
  });

  it('loads all 29 counties with provenance, rounded values, and does not duplicate on re-run', async () => {
    const first = await PublicIndicatorIngest.load(client, VaVetpop.SOURCE_NAME, VaVetpop.checksum(rows), rows);
    const second = await PublicIndicatorIngest.load(client, VaVetpop.SOURCE_NAME, VaVetpop.checksum(rows), rows);
    runIds.push(first.ingestRunId, second.ingestRunId);
    const { data, error } = await client.from('public_indicator')
      .select('geo_fips,indicator_code,value,unit,vintage,source_id,ingest_run_id').eq('indicator_code', 'veterans_count');
    expect(error).toBeNull();
    expect(data).toHaveLength(COUNTIES.length);
    expect(new Set(data!.map((r) => r.geo_fips))).toEqual(new Set(COUNTIES.map((c) => c.fips)));
    expect(data!.every((r) => r.source_id === first.sourceId && r.vintage === '2023' && r.ingest_run_id === second.ingestRunId)).toBe(true);
    expect(data!.find((r) => r.geo_fips === '49001')).toEqual(expect.objectContaining({ value: null, unit: VaVetpop.NOT_PUBLISHED }));
    expect(Number(data!.find((r) => r.geo_fips === '49035')?.value)).toBe(61000);
    expect(Number(data!.find((r) => r.geo_fips === '49049')?.value)).toBe(3000);
  });
});
