import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecipientProfileRow } from '../grants/winner-profile';
import type { RateLimiter } from './rate-limit';
import { WinnerProfileHttp, type WinnerRunOpts } from './winner-profile-http';
const [search, org] = ['winner-search', 'winner-organization'].map((f) => readFileSync(`tests/fixtures/propublica/${f}.json`, 'utf8'));
const OPP = '10101010-1010-1010-1010-101010101010', now = new Date('2026-10-15T12:00:00Z');
const award = (id: string, recipient: string, amount: number) => ({ id, source: 'usaspending', funder: 'HHS', recipient, recipient_state: 'UT', recipient_type: null, amount, fiscal_year: 2024, assistance_listing: '93.556', description: null });
/** Stub client by table: opportunity → one row; award_history → three awards (two recipients, one already cached); recipient_profile → the cached row. */
const stubClient = (cachedAt: string) => ({ from: (t: string) => {
  const data = t === 'opportunity' ? { assistance_listing: '93.556', funder: 'HHS', title: 't', description: null }
    : t === 'award_history' ? [award('a1', 'Synthetic Family Counseling Center Inc', 9), award('a2', 'SYNTHETIC FAMILY COUNSELING CENTER, INC.', 8), award('a3', 'Rocky Mountain Arts Council', 7)]
      : [{ id: 'rp-0', recipient_key: 'rocky mountain arts council|UT', fetched_at: cachedAt }];
  const q: Record<string, unknown> = {}; for (const m of ['select', 'eq', 'in', 'ilike', 'order', 'limit', 'single']) q[m] = () => q;
  q.then = (res: (v: unknown) => void) => res({ data, error: null }); return q;
} }) as unknown as SupabaseClient;
const limiter = { take: async () => {} } as unknown as RateLimiter;
afterEach(() => vi.restoreAllMocks()); describe('WinnerProfileHttp (F-506b)', () => {
  it('fetches only the top similar recipients not cached in the last 30 days, once per recipient key, through the limiter, and loads recipient_profile in one ingest run', async () => {
    const urls: string[] = [], calls: { s: string; rows: RecipientProfileRow[]; t: { table: string; onConflict: string } }[] = [];
    const httpFetch: typeof fetch = async (u) => { urls.push(String(u)); return new Response(String(u).includes('organizations/') ? org : search, { status: 200 }); };
    const load: WinnerRunOpts['load'] = async (_c, s, _sum, rows, t) => { calls.push({ s, rows, t }); return { ingestRunId: 'run-1' }; };
    const r = await WinnerProfileHttp.run({ opportunityId: OPP, env: {}, now, client: stubClient('2026-10-01T00:00:00Z'), httpFetch, limiter, load });
    expect([r.ingestRunId, r.fetched, r.cached, urls.length, calls[0].s, calls[0].t]).toEqual(['run-1', 1, 1, 2, 'propublica_990', { table: 'recipient_profile', onConflict: 'recipient_key' }]);
    expect([calls[0].rows[0].award_history_id, calls[0].rows[0].match_confidence, calls[0].rows[0].total_expenses]).toEqual(['a1', 'high', 2100000]);
    const stale = await WinnerProfileHttp.run({ opportunityId: OPP, env: {}, now, client: stubClient('2026-09-01T00:00:00Z'), httpFetch, limiter, load });
    expect([stale.fetched, stale.cached, calls[1].rows.map((x) => x.match_confidence)]).toEqual([2, 0, ['high', 'none']]); // no match: UT search, then national, no org request
  });
  it('records a failed run on an upstream non-2xx; handle: 401 without token, 400 without a uuid, 500 ingest failed, 200 with counts', async () => {
    const recordFailure = vi.fn(async () => 'run-err');
    await expect(WinnerProfileHttp.run({ opportunityId: OPP, env: {}, now, client: stubClient('2026-01-01T00:00:00Z'), httpFetch: async () => new Response('x', { status: 503 }), limiter, recordFailure }))
      .rejects.toMatchObject({ message: 'ProPublica request failed: 503', ingestRunId: 'run-err' });
    const req = (token?: string, body?: string) => new Request('http://127.0.0.1/api/ingest/winner-profiles', { method: 'POST', body, headers: token ? { authorization: `Bearer ${token}` } : {} });
    const ok = vi.fn().mockResolvedValue({ ingestRunId: 'r', fetched: 1, cached: 2, profiles: [{}, {}, {}] }), env = { INGEST_TOKEN: 's' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await Promise.all([req(), req('s', '{"opportunity_id":"x"}'), req('s', 'nope'), req('s', JSON.stringify({ opportunity_id: OPP }))].map((x) => WinnerProfileHttp.handle(x, { env, run: ok })));
    const bad = await WinnerProfileHttp.handle(req('s', JSON.stringify({ opportunity_id: OPP })), { env, run: async () => { throw new Error('boom'); }, alertFetch: async () => new Response(null) });
    expect([res.map((x) => x.status), await res[3].json(), ok.mock.calls[0][0].opportunityId, bad.status]).toEqual([[401, 400, 400, 200], { ok: true, ingestRunId: 'r', fetched: 1, cached: 2, profiles: 3 }, OPP, 500]);
  });
});
