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
      description: 'Supports family therapy for court-referred families.', raw: fixture.data[0],
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
    expect(body.filters).toEqual({ opportunity_status: { one_of: ['posted', 'forecasted'] }, applicant_type: { one_of: ['nonprofits_non_higher_education_with_501c3'] } });
    expect(body.pagination).toEqual(expect.objectContaining({ page_offset: 2, page_size: 50 }));
    expect(() => GrantsGov.searchBody(DEFAULT_CONFIG, 'x', 0)).toThrow(/page/);
  });
  it('search takes the limiter once per request, sends the key only in X-Auth, pages until a short page, fails closed upstream', async () => {
    const calls: { url: string; headers: Record<string, string>; body: { query: string; pagination: { page_offset: number } } }[] = [];
    const full = [0, 1].map((i) => ({ opportunity_id: `o${i}`, opportunity_title: `t${i}` }));
    const httpFetch: typeof fetch = async (url, init) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(url), headers: init?.headers as Record<string, string>, body });
      return new Response(JSON.stringify({ data: body.pagination.page_offset === 1 ? full : [full[0]] }), { status: 200 });
    };
    let takes = 0; const cfg = { ...DEFAULT_CONFIG, themes: ['a', 'b'], page_size: 2 };
    const rows = await GrantsGov.search(cfg, 'not-a-secret', async () => { takes++; }, httpFetch);
    expect([rows.map((r) => r.external_id), takes, calls.length]).toEqual([['o0', 'o1'], 4, 4]);
    expect(calls.map((c) => `${c.body.query}:${c.body.pagination.page_offset}`)).toEqual(['a:1', 'a:2', 'b:1', 'b:2']);
    expect([calls[0].url, calls[0].headers['X-Auth']]).toEqual(['https://api.simpler.grants.gov/v1/opportunities/search', 'not-a-secret']);
    expect(JSON.stringify(calls[0].body)).not.toContain('not-a-secret');
    await expect(GrantsGov.search(cfg, 'k', async () => {}, async () => new Response('x', { status: 429 }))).rejects.toThrow('Grants.gov search failed: 429');
    await expect(GrantsGov.search(cfg, 'k', async () => {}, async () => new Response('{"nope":1}'))).rejects.toThrow(/data array/);
  });
});
