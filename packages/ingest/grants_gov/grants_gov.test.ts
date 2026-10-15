import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, GrantsGov } from './index';

const fixture = JSON.parse(readFileSync('tests/fixtures/grants_gov/search.json', 'utf8')) as { data: unknown[] };
describe('unit: Grants.gov parser with hand-written (UNVERIFIED) v1 fixture', () => {
  it('maps every opportunity column, eligibility jsonb and raw; dedupes by external_id; checksum ignores raw', () => {
    const rows = GrantsGov.parse(fixture);
    const [a, b, ...rest] = GrantsGov.dedupe(rows);
    expect([rows.length, rest]).toEqual([3, []]);
    expect(a).toEqual(expect.objectContaining({
      source: 'grants_gov', external_id: '11111111-1111-4111-8111-111111111111', funder: 'Administration for Children and Families',
      assistance_listing: '93.590', posted_date: '2026-09-15', close_date: '2026-12-01', award_floor: 150000, award_ceiling: 600000,
      description: 'Supports family therapy for court-referred families.', raw: { ...(fixture.data[0] as object), fas_sweeps: [] },
      eligibility: { applicant_types: ['nonprofits_non_higher_education_with_501c3', 'state_governments'], funding_categories: ['income_security_and_social_services'],
        applicant_eligibility_description: 'Public and private nonprofit entities serving families in Utah or nationally.' },
    }));
    expect(b).toEqual(expect.objectContaining({ title: 'Behavioral Health Services for Court-Involved Youth', assistance_listing: '93.243', close_date: null, award_floor: null, award_ceiling: 400000, description: null }));
    expect(GrantsGov.checksum([a, b])).toBe(GrantsGov.checksum([{ ...b, raw: { other: 1 } }, a]));
    expect(GrantsGov.checksum([a])).not.toBe(GrantsGov.checksum([{ ...a, close_date: null }]));
  });
  it('fails closed on an unknown shape, naming the keys it saw; coerces bad scalars to null', () => {
    expect(() => GrantsGov.parse({ data: [{ foo: 1, bar: 2 }] })).toThrow('Grants.gov: unknown shape keys bar,foo');
    expect(() => GrantsGov.parse({ data: [{ opportunity_id: 'x' }] })).toThrow(/unknown shape/);
    expect(() => GrantsGov.parse({ data: [{ opportunity_title: 'no id' }] })).toThrow(/unknown shape/);
    expect(() => GrantsGov.parse({ message: 'Success' })).toThrow(/data array/);
    expect(GrantsGov.parse({ data: [] })).toEqual([]);
    expect(GrantsGov.parse([{ id: 7, title: 'flat', post_date: 'not a date', award_floor: -1 }])[0]).toEqual(expect.objectContaining(
      { external_id: '7', title: 'flat', posted_date: null, award_floor: null, eligibility: { applicant_types: [], applicant_eligibility_description: null, funding_categories: [] } }));
  });
  it('builds one search body per theme with nonprofit and status filters and page size <= 50', () => {
    const body = GrantsGov.searchBody({ ...DEFAULT_CONFIG, page_size: 500 }, 'court-involved youth', 2);
    expect([DEFAULT_CONFIG.themes.includes('family therapy'), body.query]).toEqual([true, 'court-involved youth']);
    expect(body.filters).toEqual({ opportunity_status: { one_of: ['posted', 'forecasted'] }, applicant_type: { one_of: ['nonprofits_non_higher_education_with_501c3'] }, close_date: { start_date_relative: 0 } });
    expect(body.pagination).toEqual(expect.objectContaining({ page_offset: 2, page_size: 50 }));
    expect(() => GrantsGov.searchBody(DEFAULT_CONFIG, 'x', 0)).toThrow(/page/);
  });
  it('adds a listing sweep and an agency-scoped category sweep after the themes; relative windows ride every sweep; empty lists add nothing', () => {
    const sweeps = GrantsGov.sweeps(DEFAULT_CONFIG);
    expect(sweeps.map((s) => s.kind)).toEqual(['theme', 'theme', 'theme', 'theme', 'listing', 'category']);
    expect(sweeps[4]?.filters).toEqual(expect.objectContaining({ assistance_listing_number: { one_of: ['93.104', '93.243', '93.556', '93.590', '93.670', '16.540', '16.575'] }, close_date: { start_date_relative: 0 } }));
    expect(sweeps[5]?.filters).toEqual(expect.objectContaining({ funding_category: { one_of: ['health', 'income_security_and_social_services', 'law_justice_and_legal_services'] }, agency: { one_of: ['HHS', 'USDOJ'] } }));
    const body = GrantsGov.searchBody(DEFAULT_CONFIG, sweeps[4]!);
    expect(['query' in body, body.pagination]).toEqual([false, expect.objectContaining({ sort_order: [{ order_by: 'post_date', sort_direction: 'descending' }] })]);
    const windows = GrantsGov.baseFilters({ ...DEFAULT_CONFIG, closes_after_days: 14, posted_within_days: 7 });
    expect([windows.close_date, windows.post_date]).toEqual([{ start_date_relative: 14 }, { start_date_relative: -7 }]);
    expect(GrantsGov.sweeps({ ...DEFAULT_CONFIG, themes: ['a'], assistance_listings: [], funding_categories: [], agencies: [] }).map((s) => s.label)).toEqual(['theme:a']);
    expect(GrantsGov.sweeps({ ...DEFAULT_CONFIG, themes: [], agencies: [] })[1]?.filters).not.toHaveProperty('agency');
  });
  it('dedupe keeps the first row per id and merges the sweep labels that found it', () => {
    const row = (id: string, sweeps: string[]) => ({ ...GrantsGov.parse({ data: [{ opportunity_id: id, opportunity_title: id }] })[0]!, raw: { fas_sweeps: sweeps } });
    const out = GrantsGov.dedupe([row('a', ['theme:x']), row('b', ['listing:1']), row('a', ['listing:1']), row('a', ['theme:x'])]);
    expect(out.map((r) => [r.external_id, r.raw.fas_sweeps])).toEqual([['a', ['theme:x', 'listing:1']], ['b', ['listing:1']]]);
  });
  it('search takes the limiter once per request, sends the key only in the X-API-Key and X-Auth headers, pages until a short page, fails closed upstream', async () => {
    const calls: { url: string; headers: Record<string, string>; body: { query: string; pagination: { page_offset: number } } }[] = [];
    const full = [0, 1].map((i) => ({ opportunity_id: `o${i}`, opportunity_title: `t${i}` }));
    const httpFetch: typeof fetch = async (url, init) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(url), headers: init?.headers as Record<string, string>, body });
      return new Response(JSON.stringify({ data: body.pagination.page_offset === 1 ? full : [full[0]] }), { status: 200 });
    };
    let takes = 0; const cfg = { ...DEFAULT_CONFIG, themes: ['a', 'b'], page_size: 2, assistance_listings: [], funding_categories: [] };
    const rows = await GrantsGov.search(cfg, 'not-a-secret', async () => { takes++; }, httpFetch);
    expect([rows.map((r) => r.external_id), takes, calls.length]).toEqual([['o0', 'o1'], 4, 4]);
    expect(calls.map((c) => `${c.body.query}:${c.body.pagination.page_offset}`)).toEqual(['a:1', 'a:2', 'b:1', 'b:2']);
    expect([calls[0].url, calls[0].headers['X-API-Key'], calls[0].headers['X-Auth']]).toEqual(['https://api.simpler.grants.gov/v1/opportunities/search', 'not-a-secret', 'not-a-secret']);
    expect(JSON.stringify(calls[0].body)).not.toContain('not-a-secret');
    await expect(GrantsGov.search(cfg, 'k', async () => {}, async () => new Response('x', { status: 429 }))).rejects.toThrow('Grants.gov search failed: 429');
    await expect(GrantsGov.search(cfg, 'k', async () => {}, async () => new Response('{"nope":1}'))).rejects.toThrow(/data array/);
  });
});
