import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { AwardAbstracts } from '../../lib/grants/award-abstract';
import { PoliteFetcher } from '../../lib/ingest/polite-fetch';
const need = (name: string): string => { if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`); return process.env[name] as string; };
const [API, ANON, SVC, DB] = [need('SUPABASE_URL'), need('SUPABASE_ANON_KEY'), need('SUPABASE_SERVICE_ROLE_KEY'), need('SUPABASE_DB_URL')]; assertLocalSupabase(API, DB);
const opts = { auth: { persistSession: false, autoRefreshToken: false } }, ALN = '16.f506c', fx = (p: string) => readFileSync(`tests/fixtures/${p}`, 'utf8');
const signIn = async (email: string) => { const c = createClient(API, ANON, opts); const { error } = await c.auth.signInWithPassword({ email, password: 'testpass123' }); if (error) throw error; return c; };
describe('integration: award_abstract load, 30-day cache and RLS', () => {
  const svc = createClient(API, SVC, opts), calls: string[] = []; let opp = '', ids: string[] = [];
  const fetcher = () => new PoliteFetcher({ sleep: async () => {}, httpFetch: async (u) => {
    const url = String(u); calls.push(url);
    return new Response(url.endsWith('robots.txt') ? '' : url.includes('F506C_DOJ') ? fx('usaspending/award-detail-doj.json') : url.includes('F506C_HHS') ? fx('usaspending/award-detail-hhs.json') : fx('ojp_awards/award-ovc-published.html'));
  } });
  beforeAll(async () => {
    opp = (await svc.from('opportunity').insert({ source: 'grants_gov', title: 'f506c family therapy', assistance_listing: ALN, eligibility: {}, raw: {} }).select('id').single()).data!.id;
    const rows = ['F506C_DOJ', 'F506C_HHS'].map((external_id, i) => ({ source: 'usaspending', external_id, recipient: `Synth ${i}`, amount: 100 + i, assistance_listing: ALN, raw: {} }));
    ids = ((await svc.from('award_history').insert(rows).select('id,external_id').order('external_id')).data ?? []).map((r) => r.id);
  });
  afterAll(async () => {
    const runs = ((await svc.from('award_abstract').select('ingest_run_id').in('award_history_id', ids)).data ?? []).map((r) => r.ingest_run_id);
    await svc.from('award_history').delete().in('id', ids); await svc.from('opportunity').delete().eq('id', opp);
    if (runs.length) await svc.from('ingest_run').delete().in('id', [...new Set(runs)]);
  });
  it('stores every source row with provenance, never blank; period of performance on award_history; a second request inside 30 days is cached', async () => {
    const first = await AwardAbstracts.forOpportunity(svc, opp, { fetcher: fetcher() });
    expect([first.fetched, first.cached]).toEqual([2, 0]);
    const { data } = await svc.from('award_abstract').select('award_history_id,source,status,word_count,reason,ingest_run_id,source_url').in('award_history_id', ids).order('source');
    const by = (id: string) => (data ?? []).filter((r) => r.award_history_id === id).map((r) => [r.source, r.status, r.reason]);
    expect(by(ids[0])).toEqual([['ojp_award_page', 'published', null], ['usaspending_detail', 'published', null]]);
    expect(by(ids[1])).toEqual([['other', 'not_published', expect.stringMatching(/^No public abstract: HHS \/ SAMHSA/)], ['usaspending_detail', 'published', null]]);
    expect(data!.every((r) => r.ingest_run_id)).toBe(true);
    expect((await svc.from('award_history').select('period_start,period_end').eq('id', ids[0]).single()).data).toEqual({ period_start: '2021-10-01', period_end: '2025-09-30' });
    const before = calls.length, again = await AwardAbstracts.forOpportunity(svc, opp, { fetcher: fetcher() });
    expect([again.fetched, again.cached, calls.length]).toEqual([0, 2, before]);
  });
  it('CHECK: a not_published row without a reason, or a published row without text, is rejected', async () => {
    for (const bad of [{ status: 'not_published' }, { status: 'published', reason: 'x' }, { status: 'bogus', reason: 'x' }])
      expect((await svc.from('award_abstract').insert({ award_history_id: ids[0], source: 'other', ...bad })).error).toBeTruthy();
  });
  it('RLS: admin and staff select only; board_viewer and anon see nothing; no client writes', async () => {
    const [admin, staff, board, anon] = [await signIn('admin@example.test'), await signIn('staff@example.test'), await signIn('board@example.test'), createClient(API, ANON, opts)];
    const seen = async (c: SupabaseClient) => ((await c.from('award_abstract').select('id').in('award_history_id', ids)).data ?? []).length;
    expect([await seen(admin), await seen(staff), await seen(board), await seen(anon)]).toEqual([4, 4, 0, 0]);
    await staff.from('award_abstract').insert({ award_history_id: ids[1], source: 'ojp_award_page', status: 'not_published', reason: 'x' });
    await admin.from('award_abstract').update({ reason: 'tampered' }).in('award_history_id', ids);
    await admin.from('award_abstract').delete().in('award_history_id', ids);
    const { data } = await svc.from('award_abstract').select('reason').in('award_history_id', ids);
    expect([data?.length, data?.some((r) => r.reason === 'tampered' || r.reason === 'x')]).toEqual([4, false]);
  });
});
