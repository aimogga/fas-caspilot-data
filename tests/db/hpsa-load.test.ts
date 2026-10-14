import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { COUNTIES } from '../../lib/synthetic/generate';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { HrsaHpsaMh } from '../../packages/ingest/hrsa_hpsa_mh';

function need(name: string): string {
  if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`);
  return process.env[name] as string;
}

const API = need('SUPABASE_URL');
const SVC = need('SUPABASE_SERVICE_ROLE_KEY');
const DB = need('SUPABASE_DB_URL');
assertLocalSupabase(API, DB);
const CODES = ['mh_hpsa_designated', 'mh_hpsa_score_max', 'mh_hpsa_designated_population'];

describe('integration: HRSA MH HPSA load into local DB', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const parsed = HrsaHpsaMh.parse(readFileSync('tests/fixtures/hrsa_hpsa_mh/utah.csv', 'utf8'), new Date('2026-10-13T12:00:00Z'));
  const rows = HrsaHpsaMh.requireComplete(HrsaHpsaMh.fill(parsed));
  const runIds: string[] = [];

  afterAll(async () => {
    await client.from('public_indicator').delete().in('indicator_code', CODES);
    if (runIds.length) await client.from('ingest_run').delete().in('id', runIds);
  });

  it('loads all 29 counties × 3 codes with provenance and does not duplicate on re-run', async () => {
    const first = await PublicIndicatorIngest.load(client, HrsaHpsaMh.SOURCE_NAME, HrsaHpsaMh.checksum(rows), rows);
    const second = await PublicIndicatorIngest.load(client, HrsaHpsaMh.SOURCE_NAME, HrsaHpsaMh.checksum(rows), rows);
    runIds.push(first.ingestRunId, second.ingestRunId);
    const { data, error } = await client.from('public_indicator').select('geo_fips,indicator_code,value,unit,vintage,source_id,ingest_run_id').in('indicator_code', CODES);
    expect(error).toBeNull();
    expect(data).toHaveLength(COUNTIES.length * 3);
    expect(new Set(data!.map((r) => r.geo_fips))).toEqual(new Set(COUNTIES.map((c) => c.fips)));
    expect(data!.every((r) => r.source_id === first.sourceId && r.vintage === '2026-10-13')).toBe(true);
    expect(data!.every((r) => r.ingest_run_id === second.ingestRunId)).toBe(true);
    expect(Number(data!.find((r) => r.geo_fips === '49007' && r.indicator_code === 'mh_hpsa_designated_population')?.value)).toBe(25000);
    expect(data!.find((r) => r.geo_fips === '49009' && r.indicator_code === 'mh_hpsa_score_max')?.unit).toBe(HrsaHpsaMh.NOT_PUBLISHED);
  });
});
