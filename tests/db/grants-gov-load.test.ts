import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { OpportunityIngest } from '../../lib/ingest/grants-gov-http';
import { GrantsGov } from '../../packages/ingest/grants_gov';

const need = (name: string): string => { if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`); return process.env[name] as string; };
const [API, SVC, DB] = [need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), need('SUPABASE_DB_URL')]; assertLocalSupabase(API, DB);
describe('integration: Grants.gov opportunities load into local DB', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = GrantsGov.dedupe(GrantsGov.parse(JSON.parse(readFileSync('tests/fixtures/grants_gov/search.json', 'utf8'))));
  const ids = rows.map((r) => r.external_id);
  const runIds: string[] = [];

  afterAll(async () => {
    await client.from('opportunity').delete().eq('source', 'grants_gov').in('external_id', ids);
    if (runIds.length) await client.from('ingest_run').delete().in('id', runIds); });
  it('upserts on (source, external_id) with eligibility and raw jsonb and run provenance; no duplicates on re-run', async () => {
    const first = await OpportunityIngest.load(client, GrantsGov.SOURCE_NAME, GrantsGov.checksum(rows), rows);
    const second = await OpportunityIngest.load(client, GrantsGov.SOURCE_NAME, GrantsGov.checksum(rows), rows);
    runIds.push(first.ingestRunId, second.ingestRunId);
    const { data, error } = await client.from('opportunity').select('external_id,funder,assistance_listing,close_date,award_ceiling,eligibility,raw,ingest_run_id').eq('source', 'grants_gov').in('external_id', ids);
    expect([error, data?.length, data?.every((r) => r.ingest_run_id === second.ingestRunId)]).toEqual([null, 2, true]);
    const a = data!.find((r) => r.external_id === ids[0])!;
    expect(a).toEqual(expect.objectContaining({ funder: 'Administration for Children and Families', assistance_listing: '93.590', close_date: '2026-12-01' }));
    expect([Number(a.award_ceiling), a.eligibility.applicant_types[0], a.raw.opportunity_number]).toEqual([600000, 'nonprofits_non_higher_education_with_501c3', 'HHS-2026-ACF-ACYF-CA-0001']);
    expect((await client.from('source_registry').select('last_success_at').eq('name', 'grants_gov').single()).data?.last_success_at).not.toBeNull();
    const run = await client.from('ingest_run').select('status,rows_loaded,checksum').eq('id', second.ingestRunId).single();
    expect(run.data).toEqual({ status: 'ok', rows_loaded: 2, checksum: GrantsGov.checksum(rows) });
  });
});
