import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { summarize } from '../../lib/grants/award-history';
import { AwardHistoryIngest } from '../../lib/ingest/usaspending-http';
import { UsaSpending } from '../../packages/ingest/usaspending';
const need = (name: string): string => { if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`); return process.env[name] as string; };
const [API, SVC, DB] = [need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), need('SUPABASE_DB_URL')]; assertLocalSupabase(API, DB);
describe('integration: USAspending awards load into local DB', () => {
  const client = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = UsaSpending.dedupe(UsaSpending.parse(JSON.parse(readFileSync('tests/fixtures/usaspending/search.json', 'utf8')))), ids = rows.map((r) => r.external_id), runIds: string[] = [];
  afterAll(async () => {
    await client.from('award_history').delete().eq('source', 'usaspending').in('external_id', ids);
    if (runIds.length) await client.from('ingest_run').delete().in('id', runIds); });
  it('upserts on (source, external_id) with provenance, no duplicates on re-run; SQL award_history_summary matches the pure summary', async () => {
    const load = () => AwardHistoryIngest.load(client, UsaSpending.SOURCE_NAME, UsaSpending.checksum(rows), rows), first = await load(), second = await load(); runIds.push(first.ingestRunId, second.ingestRunId);
    const { data, error } = await client.from('award_history').select('external_id,recipient,recipient_state,amount,fiscal_year,assistance_listing,raw,ingest_run_id').eq('source', 'usaspending').in('external_id', ids);
    expect([error, data?.length, data?.every((r) => r.ingest_run_id === second.ingestRunId)]).toEqual([null, 3, true]);
    const a = data!.find((r) => r.external_id === ids[0])!;
    expect([a.recipient, a.recipient_state, a.fiscal_year, a.assistance_listing, Number(a.amount), a.raw['Award ID']]).toEqual(['Example Family Services Inc', 'UT', 2024, '93.590', 450000, '90CA1001']);
    expect((await client.from('source_registry').select('last_success_at').eq('name', 'usaspending').single()).data?.last_success_at).not.toBeNull();
    expect((await client.from('ingest_run').select('status,rows_loaded,checksum').eq('id', second.ingestRunId).single()).data).toEqual({ status: 'ok', rows_loaded: 3, checksum: UsaSpending.checksum(rows) });
    const s = await client.rpc('award_history_summary', { p_assistance_listing: '93.590' }), pure = summarize(rows.filter((r) => r.assistance_listing === '93.590').map((r, i) => ({ ...r, id: String(i) })));
    expect([s.error, Number(s.data.count), Number(s.data.median), Number(s.data.utah_share), s.data.recipient_types]).toEqual([null, pure.count, pure.median, pure.utah_share, pure.recipient_types]);
  });
});
