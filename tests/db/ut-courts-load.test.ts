import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { COUNTIES } from '../../lib/synthetic/generate';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { PublicIndicatorIngest } from '../../packages/ingest/public-indicator';
import { CODES, UtCourts } from '../../packages/ingest/ut_courts';

const need = (name: string): string => process.env[name] ?? (() => { throw new Error(`Missing ${name}. Run pnpm test:db`); })();
const [API, SVC, DB] = [need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), need('SUPABASE_DB_URL')];
assertLocalSupabase(API, DB);

describe('integration: Utah Courts filings load into local DB', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const runIds: string[] = [];

  afterAll(async () => {
    await client.from('public_indicator').delete().in('indicator_code', CODES);
    if (runIds.length) await client.from('ingest_run').delete().in('id', runIds);
  });

  it('loads 2 FY × 29 counties × 4 codes with provenance and does not duplicate on re-run', async () => {
    const rows = UtCourts.requireComplete(UtCourts.fill(await UtCourts.parse(readFileSync('tests/fixtures/ut_courts/filings.xlsx'))));
    const first = await PublicIndicatorIngest.load(client, UtCourts.SOURCE_NAME, UtCourts.checksum(rows), rows);
    const second = await PublicIndicatorIngest.load(client, UtCourts.SOURCE_NAME, UtCourts.checksum(rows), rows);
    runIds.push(first.ingestRunId, second.ingestRunId);
    const { data, error } = await client.from('public_indicator').select('geo_fips,indicator_code,value,unit,vintage,source_id,ingest_run_id').in('indicator_code', CODES);
    expect(error).toBeNull();
    expect(data).toHaveLength(COUNTIES.length * CODES.length * 2);
    expect(new Set(data!.map((r) => r.geo_fips))).toEqual(new Set(COUNTIES.map((c) => c.fips)));
    expect(new Set(data!.map((r) => r.vintage))).toEqual(new Set(['FY2025', 'FY2026']));
    expect(data!.every((r) => r.source_id === first.sourceId && r.ingest_run_id === second.ingestRunId)).toBe(true);
    expect(Number(data!.find((r) => r.geo_fips === '49001' && r.indicator_code === 'court_filings_total' && r.vintage === 'FY2026')?.value)).toBe(327);
    expect(data!.find((r) => r.geo_fips === '49009' && r.indicator_code === 'court_filings_total' && r.vintage === 'FY2025')?.unit).toBe(UtCourts.NOT_PUBLISHED);
  });
});
