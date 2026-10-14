import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { FunderHistoryQuery } from '../../lib/grants/funder-history';
import { FoundationHistoryIngest } from '../../lib/ingest/propublica-http';
import { ProPublica } from '../../packages/ingest/propublica';
const need = (name: string): string => { if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`); return process.env[name] as string; }, [API, SVC, DB] = [need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), need('SUPABASE_DB_URL')]; assertLocalSupabase(API, DB);
describe('integration: ProPublica 990-PF filing rows load into local DB (CI-only)', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = ProPublica.toAwardHistoryRows(ProPublica.parseOrganization(JSON.parse(readFileSync('tests/fixtures/propublica/organization.json', 'utf8')))), ids = rows.map((r) => r.external_id), runIds: string[] = [];
  afterAll(async () => { await client.from('award_history').delete().eq('source', 'irs_990pf').in('external_id', ids); if (runIds.length) await client.from('ingest_run').delete().in('id', runIds); });
  it('upserts on (source, external_id) with provenance, no duplicates on re-run; source row registered; summary reads back data years and gap', async () => {
    const load = () => FoundationHistoryIngest.load(client, ProPublica.SOURCE_NAME, ProPublica.checksum(rows), rows), first = await load(), second = await load(); runIds.push(first.ingestRunId, second.ingestRunId);
    const { data, error } = await client.from('award_history').select('external_id,funder,recipient,amount,fiscal_year,raw,ingest_run_id').eq('source', 'irs_990pf').in('external_id', ids);
    expect([error, data?.length, data?.every((r) => r.ingest_run_id === second.ingestRunId)]).toEqual([null, 3, true]);
    const a = data!.find((r) => r.external_id === ids[0])!;
    expect([a.funder, a.recipient, a.amount, a.fiscal_year, a.raw.ein, a.raw.totfuncexpns]).toEqual(['EXAMPLE FAMILY FOUNDATION', null, null, 2023, '100000001', 2500000]);
    const src = (await client.from('source_registry').select('last_success_at,commercial_ok,cadence').eq('name', 'propublica_990').single()).data, s = await FunderHistoryQuery.byFunderName(client, 'Example Family Foundation');
    expect([src?.last_success_at === null, src?.commercial_ok, src?.cadence, s.data_years, s.capacity_band, s.reason.includes('filing totals only')]).toEqual([false, false, 'quarterly', [2023, 2022, 2021], 'medium', true]);
    expect((await client.from('ingest_run').select('status,rows_loaded,checksum').eq('id', second.ingestRunId).single()).data).toEqual({ status: 'ok', rows_loaded: 3, checksum: ProPublica.checksum(rows) });
  });
});
