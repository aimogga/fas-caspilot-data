import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAP_NO_GRANTEES, ProPublica, capacityBand, nameScore, normalizeEin } from './index';
const search = JSON.parse(readFileSync('tests/fixtures/propublica/search.json', 'utf8')) as { organizations: Record<string, unknown>[] };
const org = JSON.parse(readFileSync('tests/fixtures/propublica/organization.json', 'utf8')) as { filings_with_data: Record<string, unknown>[] };
describe('unit: ProPublica parser with hand-written (UNVERIFIED) v2 fixtures', () => {
  it('search keeps 501(c)(3) candidates only, pads EINs, upper-cases state; best match by EIN or name score', () => {
    const cands = ProPublica.parseSearch(search);
    expect(cands.map((c) => [c.ein, c.name, c.subsection, c.state])).toEqual([['100000001', 'EXAMPLE FAMILY FOUNDATION', 3, 'UT'], ['100000002', 'Example Family Services Inc', 3, 'UT'], ['100000004', 'Unrelated Veterans Fund', 3, 'UT']]);
    expect(cands[0]).toEqual(expect.objectContaining({ city: 'SALT LAKE CITY', ntee_code: 'T20', score: 12.5 }));
    expect([ProPublica.bestMatch('Example Family Foundation', cands)?.ein, ProPublica.bestMatch('10-0000002', cands)?.ein, ProPublica.bestMatch('Example Family Services', cands)?.ein]).toEqual(['100000001', '100000002', '100000002']);
    expect([ProPublica.bestMatch('Rocky Mountain Arts Council', cands), ProPublica.bestMatch('99-9999999', cands), nameScore('The Example Foundation Inc', 'EXAMPLE'), nameScore('a', 'b')]).toEqual([null, null, 1, 0]);
    expect([normalizeEin(1234567), normalizeEin('12345678'), normalizeEin('00-0000000'), normalizeEin('')]).toEqual([null, '012345678', '000000000', null]);
    expect(ProPublica.searchUrl('Example Family Foundation')).toBe('https://projects.propublica.org/nonprofits/api/v2/search.json?q=Example%20Family%20Foundation&state%5Bid%5D=UT&page=0');
    expect([ProPublica.searchUrl('x', null, 2).endsWith('q=x&page=2'), ProPublica.orgUrl('10-0000001')]).toEqual([true, 'https://projects.propublica.org/nonprofits/api/v2/organizations/100000001.json']);
    expect(() => ProPublica.searchUrl('x', 'UT', -1)).toThrow(/page/); expect(() => ProPublica.orgUrl('12')).toThrow(/EIN/);
  });
  it('organization keeps the last 3 filings with data, maps form types, derives capacity band, states data years and gaps', () => {
    const p = ProPublica.parseOrganization(org);
    expect([p.ein, p.name, p.state, p.ntee_code, p.subsection, p.grantmaking_capacity_band, p.data_years]).toEqual(['100000001', 'EXAMPLE FAMILY FOUNDATION', 'UT', 'T20', 3, 'medium', [2023, 2022, 2021]]);
    expect(p.filings.map((f) => [f.tax_year, f.tax_prd, f.form_type, f.total_revenue, f.total_expenses, f.total_assets, f.pdf_url?.slice(-16) ?? null]))
      .toEqual([[2023, '202312', '990PF', 3100000, 2500000, 41000000, 'example-2023.pdf'], [2022, '202212', '990PF', 2800000, 2200000, 39000000, null], [2021, '202112', '990PF', 2600000, 1900000, 37000000, null]]);
    expect(p.gaps).toEqual([GAP_NO_GRANTEES, 'Latest 990-PF data year on ProPublica is 2023; later years are not yet extracted.']);
    expect([capacityBand(null), capacityBand(999_999), capacityBand(1_000_000), capacityBand(10_000_000)]).toEqual(['unknown', 'small', 'medium', 'large']);
    const ez = ProPublica.parseOrganization({ organization: { ein: '10-0000002', name: 'Example Family Services Inc' }, filings_with_data: [{ tax_prd_yr: 2023, formtype: 1, totfuncexpns: 50000 }] });
    expect([ez.filings[0].form_type, ez.data_years, ez.grantmaking_capacity_band, ez.gaps[1], ProPublica.toAwardHistoryRows(ez)]).toEqual(['990EZ', [], 'small', expect.stringMatching(/^No 990-PF filings/), []]);
  });
  it('rows: one irs_990pf row per 990-PF year, null recipient/amount, external_id propublica:<ein>:<tax_prd>, raw keeps the filing + ein; checksum ignores raw', () => {
    const rows = ProPublica.toAwardHistoryRows(ProPublica.parseOrganization(org));
    expect(rows.map((r) => [r.external_id, r.fiscal_year])).toEqual([['propublica:100000001:202312', 2023], ['propublica:100000001:202212', 2022], ['propublica:100000001:202112', 2021]]);
    expect(rows[0]).toEqual({ source: 'irs_990pf', external_id: 'propublica:100000001:202312', funder: 'EXAMPLE FAMILY FOUNDATION', recipient: null, recipient_state: 'UT', amount: null, fiscal_year: 2023, assistance_listing: null,
      description: `990-PF filing totals, tax year 2023 (ProPublica Nonprofit Explorer). ${GAP_NO_GRANTEES}`, raw: { ...org.filings_with_data[0], ein: '100000001' } });
    expect([ProPublica.checksum(rows), ProPublica.checksum([rows[0]]) === ProPublica.checksum([{ ...rows[0], fiscal_year: 1 }])]).toEqual([ProPublica.checksum([...rows].reverse().map((r) => ({ ...r, raw: {} }))), false]);
  });
  it('fails closed on unknown shapes, naming the keys it saw', () => {
    expect(() => ProPublica.parseSearch({ organizations: [{ foo: 1, name: 'x' }] })).toThrow('ProPublica: unknown shape keys foo,name');
    expect(() => ProPublica.parseSearch({ results: [] })).toThrow(/organizations array/); expect(ProPublica.parseSearch({ organizations: [] })).toEqual([]);
    expect(() => ProPublica.parseOrganization({ organization: { ein: 100000001 } })).toThrow('ProPublica: unknown organization shape keys ein');
    expect(() => ProPublica.parseOrganization({ error: 'not found' })).toThrow(/unknown organization shape/);
  });
  it('lookup: EIN goes straight to the organization; names search Utah then national, one take per request; null when nothing matches; non-2xx throws', async () => {
    const urls: string[] = []; let takes = 0;
    const httpFetch: typeof fetch = async (u) => { const url = String(u); urls.push(url); return new Response(JSON.stringify(url.includes('organizations/') ? org : url.includes('state') ? { organizations: [] } : search), { status: 200 }); };
    const take = async () => { takes++; };
    expect((await ProPublica.lookup('Example Family Foundation', take, httpFetch))?.ein).toBe('100000001');
    expect([urls.map((u) => u.replace(ProPublica.API, '')), takes]).toEqual([['/search.json?q=Example%20Family%20Foundation&state%5Bid%5D=UT&page=0', '/search.json?q=Example%20Family%20Foundation&page=0', '/organizations/100000001.json'], 3]);
    urls.length = 0; expect((await ProPublica.lookup('10-0000001', take, httpFetch))?.name).toBe('EXAMPLE FAMILY FOUNDATION'); expect(urls).toEqual([`${ProPublica.API}/organizations/100000001.json`]);
    expect(await ProPublica.lookup('Nobody Here', take, httpFetch)).toBeNull();
    await expect(ProPublica.lookup('x', take, async () => new Response('x', { status: 429 }))).rejects.toThrow('ProPublica request failed: 429');
  });
});
