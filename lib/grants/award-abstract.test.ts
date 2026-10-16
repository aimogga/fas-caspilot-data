import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { UsaSpending } from '../../packages/ingest/usaspending';
import { PoliteFetcher } from '../ingest/polite-fetch';
import { AwardAbstracts, abstractRows, fetchOjp } from './award-abstract';
const detail = (f: string) => UsaSpending.parseDetail(JSON.parse(readFileSync(`tests/fixtures/usaspending/award-detail-${f}.json`, 'utf8')));
const html = (f: string) => readFileSync(`tests/fixtures/ojp_awards/${f}.html`, 'utf8');
const fetcher = (page: () => Response) => new PoliteFetcher({ sleep: async () => {}, httpFetch: async (u) => (String(u).endsWith('robots.txt') ? new Response('') : page()) });
describe('unit: award abstracts (F-506c)', () => {
  it('DOJ/OJP award: USAspending description published + the OJP abstract published', () => {
    const rows = abstractRows('a1', detail('doj'), { url: 'https://ovc.ojp.gov/funding/awards/x', parsed: { status: 'published', award_number: 'x', text: 'one two three', word_count: 3 } });
    expect(rows.map((r) => [r.source, r.status, r.word_count, r.reason])).toEqual([['usaspending_detail', 'published', 45, null], ['ojp_award_page', 'published', 3, null]]);
    expect(rows[0].text).toBe(detail('doj').description);
  });
  it('other agencies and missing descriptions are not_published with a reason, never blank', () => {
    const rows = abstractRows('a2', detail('hhs'));
    expect(rows.map((r) => [r.source, r.status, r.text === null, r.reason])).toEqual([['usaspending_detail', 'published', false, null],
      ['other', 'not_published', true, 'No public abstract: HHS / SAMHSA award pages are not a supported source']]);
    const bare = abstractRows('a3', { ...detail('doj'), description: null }, { url: null });
    expect(bare.map((r) => [r.status, r.reason])).toEqual([['not_published', 'USAspending award has no description'], ['not_published', 'award number format not recognised; no OJP page URL']]);
    expect(abstractRows('a4', detail('doj'), { url: 'u', error: 'boom' })[1]).toEqual(expect.objectContaining({ status: 'fetch_failed', reason: 'boom', source_url: 'u' }));
  });
  it('OJP fetch: sign-in redirect and 404 are not_published; a broken layout or 500 is an error (nothing stored as text)', async () => {
    const login = await fetchOjp(fetcher(() => new Response(null, { status: 307, headers: { location: 'https://ovc.ojp.gov/user/login?destination=/funding/awards/x' } })), '15POVC22GG00810ASSI');
    expect([login.url, login.parsed?.status, login.parsed?.status === 'not_published' && login.parsed.reason]).toEqual(['https://ovc.ojp.gov/funding/awards/15povc-22-gg-00810-assi', 'not_published', expect.stringMatching(/sign-in/)]);
    expect((await fetchOjp(fetcher(() => new Response('', { status: 404 })), '15POVC22GG00810ASSI')).parsed?.status).toBe('not_published');
    expect((await fetchOjp(fetcher(() => new Response(html('award-broken-layout'))), '15POVC22GG00810ASSI')).error).toMatch(/layout not recognised/);
    expect((await fetchOjp(fetcher(() => new Response('', { status: 500 })), '15POVC22GG00810ASSI')).error).toBe('OJP page fetch failed: 500');
    expect((await fetchOjp(fetcher(() => new Response(html('award-ovc-published'))), '15POVC22GG00810ASSI')).parsed?.status).toBe('published');
    expect(await fetchOjp(fetcher(() => new Response('')), 'nonsense')).toEqual({ url: null });
  });
  it('HTTP: token required, opportunity_id required', async () => {
    const env = { INGEST_TOKEN: 'not-a-secret' }, never = { from: () => { throw new Error('no db'); } } as unknown as SupabaseClient;
    const req = (token: string, body: string) => new Request('http://127.0.0.1/api/grants/award-abstracts', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body });
    expect((await AwardAbstracts.handle(req('wrong', '{}'), { env, client: never })).status).toBe(401);
    expect((await AwardAbstracts.handle(req('not-a-secret', '{}'), { env, client: never })).status).toBe(400);
    expect((await AwardAbstracts.handle(req('not-a-secret', '{"opportunity_id":"x"}'), { env, client: never })).status).toBe(500);
  });
});
