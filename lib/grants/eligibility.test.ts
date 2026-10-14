import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkEligibility, ELIGIBILITY_DEFAULTS, FLAG_CODES, fromMatchFlags, sortFlags, toMatchFlags } from './eligibility';
import { FAS_PROFILE_SYNTHETIC, loadOrgProfile, profileFromOrgRow } from './profile';
import type { Flag, OpportunityInput, OrgProfile } from './types';

// Fixture field mapping: see tests/fixtures/grants/opportunities.json `_mapping` (Grants.gov v1 summary -> opportunity.eligibility).
const fixture = JSON.parse(readFileSync('tests/fixtures/grants/opportunities.json', 'utf8')) as { opportunities: OpportunityInput[] };
const opp = (id: string) => fixture.opportunities.find((o) => o.id === id)!;
const NOW = new Date('2026-10-14T12:00:00Z');
const org = FAS_PROFILE_SYNTHETIC;
const run = (id: string, profile: OrgProfile = org) => checkEligibility(opp(id), profile, NOW);
const byCode = (flags: Flag[], code: string) => flags.find((f) => f.code === code);

describe('checkEligibility on fixtures', () => {
  it('clearly eligible: no flags, every check passes', () => {
    const r = run('eligible');
    expect(r).toEqual({ eligible: true, flags: [], checks: Object.fromEntries(FLAG_CODES.map((c) => [c, 'pass'])) });
  });
  it('state-only applicant type is a blocker with a plain-English message', () => {
    const r = run('state-only');
    expect([r.eligible, r.checks.applicant_type]).toEqual([false, 'flagged']);
    expect(byCode(r.flags, 'applicant_type')).toEqual({ code: 'applicant_type', severity: 'blocker', message: 'Only state governments may apply', source_ref: 'opportunity.eligibility.applicant_types' });
  });
  it('national with cost share: warning showing the percent, still eligible', () => {
    const r = run('national-cost-share');
    expect([r.eligible, r.checks.geography]).toEqual([true, 'pass']);
    expect(byCode(r.flags, 'cost_share')).toMatchObject({ severity: 'warning', message: 'Requires cost share or match of 25%' });
  });
  it('closed last week is a blocker naming the date', () => {
    const r = run('closed-last-week');
    expect([r.eligible, r.flags.length]).toEqual([false, 1]);
    expect(r.flags[0]).toMatchObject({ severity: 'blocker', message: 'Closed on 2026-10-07', source_ref: 'opportunity.close_date' });
  });
  it('closes in 6 days is a warning inside the 21-day window', () => {
    const r = run('closes-soon');
    expect([r.eligible, r.flags.length]).toEqual([true, 1]);
    expect(r.flags[0]).toMatchObject({ severity: 'warning', message: 'Closes in 6 days' });
    expect(checkEligibility(opp('closes-soon'), org, NOW, { ...ELIGIBILITY_DEFAULTS, closeWarnDays: 5 }).flags).toEqual([]);
  });
  it('award floor above 50% of budget is a warning; Colorado-only text is a geography blocker', () => {
    const r = run('floor-too-high');
    expect(r.eligible).toBe(false);
    expect(byCode(r.flags, 'award_size')).toMatchObject({ severity: 'warning', message: 'Award floor $2,000,000 is above $300,000 (50% of annual budget)', source_ref: 'opportunity.award_floor' });
    expect(byCode(r.flags, 'geography')).toMatchObject({ severity: 'blocker', message: 'Only applicants in Colorado may apply' });
  });
  it('missing eligibility data yields info flags and eligible = unknown, never a silent pass', () => {
    const r = run('missing-eligibility');
    expect(r.eligible).toBe('unknown');
    expect(r.flags.map((f) => [f.code, f.severity, f.message])).toEqual([
      ['applicant_type', 'info', 'Could not check applicant type: opportunity.eligibility.applicant_types missing'],
      ['award_size', 'info', 'Could not check award size: opportunity.award_floor missing'],
      ['close_date', 'info', 'Could not check close date: opportunity.close_date missing'],
      ['cost_share', 'info', 'Could not check cost share: opportunity.eligibility.is_cost_sharing missing'],
      ['geography', 'info', 'Could not check geography: opportunity.description missing'],
      ['theme_overlap', 'info', 'Could not check program themes: opportunity.eligibility.funding_categories missing'],
    ]);
    expect(r.checks).toMatchObject({ applicant_type: 'unclear', sam_registration: 'pass', loi_required: 'pass' });
  });
  it('LOI, audit and minimum years are read from text; the synthetic profile passes audit and years', () => {
    const r = run('loi-required');
    expect([r.eligible, r.flags.map((f) => f.code)]).toEqual([true, ['loi_required']]);
    expect(r.flags[0]).toMatchObject({ severity: 'warning', message: 'Letter of intent or pre-application required before the full proposal' });
    expect(r.checks).toMatchObject({ audit_required: 'pass', min_years_operating: 'pass' });
  });
  it('org facts flip checks: young org, no audit, expired SAM, unknown budget', () => {
    const young = run('loi-required', { ...org, years_operating: 1, has_audited_financials: false });
    expect(young.eligible).toBe(false);
    expect(young.flags.map((f) => [f.code, f.severity])).toEqual([['audit_required', 'blocker'], ['min_years_operating', 'blocker'], ['loi_required', 'warning']]);
    expect(byCode(young.flags, 'min_years_operating')?.message).toBe('Requires 3 years operating; FAS has 1');
    expect(run('eligible', { ...org, sam_status: 'expired' }).flags)
      .toEqual([{ code: 'sam_registration', severity: 'warning', message: 'SAM.gov registration expired; renew before applying', source_ref: 'org.sam_status' }]);
    const noBudget = run('eligible', { ...org, annual_budget_usd: 'unknown' });
    expect([noBudget.eligible, noBudget.flags[0]?.message]).toEqual(['unknown', 'Could not check award size: org.annual_budget_usd missing']);
  });
  it('flags are ordered by severity then code, deterministically', () => {
    const mk = (code: string, severity: Flag['severity']): Flag => ({ code, severity, message: code, source_ref: 'x' });
    const shuffled = [mk('loi_required', 'warning'), mk('geography', 'blocker'), mk('award_size', 'info'), mk('close_date', 'warning'), mk('applicant_type', 'blocker')];
    expect(sortFlags(shuffled).map((f) => f.code)).toEqual(['applicant_type', 'geography', 'close_date', 'loi_required', 'award_size']);
    expect(sortFlags(shuffled)).toEqual(sortFlags([...shuffled].reverse()));
  });
});

describe('match_result.flags json round-trip', () => {
  it('toMatchFlags / fromMatchFlags preserve eligible and flags', () => {
    const r = run('floor-too-high');
    const json = JSON.parse(JSON.stringify(toMatchFlags(r)));
    expect(json).toEqual({ eligible: false, flags: r.flags });
    expect(fromMatchFlags(json)).toEqual({ eligible: false, flags: r.flags });
  });
  it('rejects malformed json', () => {
    expect(() => fromMatchFlags(null)).toThrow('expected { eligible, flags[] }');
    expect(() => fromMatchFlags({ eligible: 'maybe', flags: [] })).toThrow('expected { eligible, flags[] }');
    expect(() => fromMatchFlags({ eligible: true, flags: [{ code: 'nope', severity: 'info', message: 'm', source_ref: 's' }] })).toThrow('flags[0]: invalid flag');
    expect(() => fromMatchFlags({ eligible: true, flags: [{ code: 'geography', severity: 'red', message: 'm', source_ref: 's' }] })).toThrow('flags[0]: invalid flag');
  });
});

describe('org profile', () => {
  it('maps org columns and settings, filling gaps with unknown', () => {
    const p = profileFromOrgRow({ name: 'Org', ein: null, uei: 'ABC', state: 'UT', settings: { sam_status: 'active', annual_budget_usd: 1, program_themes: ['therapy'], is_501c3: 'yes' } });
    expect(p).toMatchObject({ state: 'UT', sam_status: 'active', annual_budget_usd: 1, program_themes: ['therapy'], is_501c3: 'unknown', years_operating: 'unknown', service_counties: 'unknown' });
    expect(profileFromOrgRow({ name: 'Org', ein: null, uei: null, state: null, settings: null }).sam_status).toBe('unknown');
  });
  it('loadOrgProfile reads one org row and returns null when hidden', async () => {
    const mk = (data: unknown, error: unknown = null) =>
      ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }) }) as never;
    expect(await loadOrgProfile(mk({ name: 'Org', ein: null, uei: null, state: 'UT', settings: {} }), 'id')).toMatchObject({ name: 'Org', state: 'UT' });
    expect(await loadOrgProfile(mk(null), 'id')).toBeNull();
    expect(await loadOrgProfile(mk(null, { message: 'denied' }), 'id')).toBeNull();
  });
});
