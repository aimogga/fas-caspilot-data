import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ProPublica } from '../../packages/ingest/propublica';
import { FAS_PROFILE_SYNTHETIC } from './profile';
import { PROPUBLICA_ATTRIBUTION, compareToFas, isFresh, matchRecipient, money, normalizeName, recipientKey, toProfileRow, type StoredRecipientProfile } from './winner-profile';
const [search, org] = ['winner-search', 'winner-organization'].map((f) => JSON.parse(readFileSync(`tests/fixtures/propublica/${f}.json`, 'utf8')) as unknown);
const cands = ProPublica.parseSearch(search), now = new Date('2026-10-15T12:00:00Z'), award = { id: 'aw-1', recipient: 'Synthetic Family Counseling Center, Inc.', recipient_state: 'UT' };
const stored = (o: Partial<StoredRecipientProfile> = {}): StoredRecipientProfile => ({ ...toProfileRow(award, matchRecipient(award.recipient, 'UT', cands), ProPublica.parseOrganization(org), now), id: 'rp-1', ingest_run_id: 'run-1', ...o });
describe('unit: winner profiles from ProPublica fixtures (F-506b)', () => {
  it('confidence: exact normalized name + same state is high, fuzzy + same state is medium, another state is low, nothing is none', () => {
    const m = (name: string, state: string | null) => { const r = matchRecipient(name, state, cands); return [r.candidate?.ein ?? null, r.method, r.confidence]; };
    expect(m('Synthetic Family Counseling Center, Inc.', 'UT')).toEqual(['200000001', 'exact_name_state', 'high']);
    expect(m('synthetic family counseling', 'ut')).toEqual(['200000001', 'fuzzy_name_state', 'medium']);
    expect(m('Synthetic Youth Arts Alliance', 'UT')).toEqual(['200000003', 'name_other_state', 'low']);
    expect(m('Synthetic Family Counseling Center', null)).toEqual(['200000001', 'name_other_state', 'low']);
    expect(m('Rocky Mountain Arts Council', 'UT')).toEqual([null, 'none', 'none']);
    expect([normalizeName('The A&B Co., LLC'), recipientKey(' Synthetic Family Counseling Center Inc ', 'ut')]).toEqual(['a and b', 'synthetic family counseling center|UT']);
  });
  it('row: latest 990 facts, ruling year, contributions share, ProPublica page; no officer or compensation fields; none stores an explicit gap', () => {
    const r = stored();
    expect([r.ein, r.matched_name, r.state, r.ntee_code, r.ruling_year, r.latest_tax_year, r.total_revenue, r.total_expenses, r.program_service_expenses, r.contributions_share, r.match_confidence, r.source_url])
      .toEqual(['200000001', 'SYNTHETIC FAMILY COUNSELING CENTER INC', 'UT', 'F22', 1998, 2023, 2400000, 2100000, 1700000, 0.75, 'high', 'https://projects.propublica.org/nonprofits/organizations/200000001']);
    expect(Object.keys(r).filter((k) => /officer|compens|raw|pct_/i.test(k))).toEqual([]);
    const gap = toProfileRow({ ...award, recipient: 'Rocky Mountain Arts Council' }, matchRecipient('Rocky Mountain Arts Council', 'UT', cands), null, now);
    expect([gap.ein, gap.total_expenses, gap.match_method, gap.match_confidence, gap.source_url, gap.recipient_key]).toEqual([null, null, 'none', 'none', null, 'rocky mountain arts council|UT']);
  });
  it('compareToFas: one sentence with expenses, year, bands, ratio and confidence; source_ref recipient_profile:<id>; ProPublica attribution', () => {
    expect(compareToFas(stored(), FAS_PROFILE_SYNTHETIC)).toEqual({ source_ref: 'recipient_profile:rp-1', attribution: PROPUBLICA_ATTRIBUTION,
      reason: "Winner's latest expenses $2.1M (FY2023, medium) vs FAS budget $600K (small), about 3.5× FAS; high confidence match on SYNTHETIC FAMILY COUNSELING CENTER INC." });
    expect(compareToFas(stored({ match_confidence: 'none' }), FAS_PROFILE_SYNTHETIC).reason).toBe('No Form 990 match found for Synthetic Family Counseling Center, Inc.; size comparison not available.');
    expect(compareToFas(stored({ total_expenses: null }), FAS_PROFILE_SYNTHETIC).reason).toMatch(/has no expense total; size comparison not available \(high confidence match\)\.$/);
    expect(compareToFas(stored(), { ...FAS_PROFILE_SYNTHETIC, annual_budget_usd: 'unknown' }).reason).toContain('vs FAS budget not on file;');
    expect(PROPUBLICA_ATTRIBUTION).toMatch(/ProPublica Data Terms of Use/);
  });
  it('cache: fresh under 30 days; money formats compactly', () => {
    expect([isFresh('2026-09-16T12:00:01Z', now), isFresh('2026-09-15T12:00:00Z', now), money(2_100_000), money(600_000), money(1_000_000), money(950)]).toEqual([true, false, '$2.1M', '$600K', '$1M', '$950']);
  });
});
