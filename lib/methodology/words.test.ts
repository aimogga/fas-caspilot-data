import { describe, expect, it } from 'vitest';
import { headlines, inputTerm, pointsText, STAT_TERMS, summary, weightCards } from './words';

const input = { key: 'uninsured', label: 'Uninsured rate', known: true, source: 'Census SAHIE', vintage: '2023', asOf: 'Oct 2026', status: 'current' as const };
const weight = { key: 'uninsured', label: 'Uninsured rate', known: true, weight: '1', share: '100%', points: 100 };
const view = { version: 'v2-synthetic', approvedLabel: 'Oct 2026', inputs: [input], weights: [weight], scored: 26, counties: 29 };

describe('DS-16b methodology words', () => {
  it('writes statistical terms without product codes and keeps the alias to the need-map indicator term', () => {
    for (const text of Object.values(STAT_TERMS)) expect(text).not.toMatch(/\bpct\b|\bMOE\b|σ|μ|z_i/);
    expect(inputTerm('uninsured', 'Uninsured rate').title).toBe('Uninsured rate');
    expect(inputTerm('uninsured', 'Uninsured rate').plain).toMatch(/no health insurance/);
    expect(inputTerm('mystery', 'mystery').title).toBe('mystery');
  });
  it('turns a weight into points out of 100 with the version as its source', () => {
    expect([pointsText(30), pointsText(null)]).toEqual(['30 of 100 points', 'Not published']);
    expect(weightCards(view)[0]).toMatchObject({ points: '100 of 100 points', source: 'Census SAHIE 2023', asOf: 'Oct 2026', version: 'Need score version v2-synthetic, approved Oct 2026', hidden: undefined });
    const none = weightCards({ ...view, weights: [{ ...weight, points: null }], inputs: [{ ...input, source: '—', vintage: '—', asOf: '—' }] })[0];
    expect([none?.points, none?.source, none?.hidden]).toEqual(['Not published', 'Not published', 'The source did not publish this for this county in that release.']);
  });
  it('writes the section headlines and the summary from the stored view', () => {
    expect(headlines(view)).toMatchObject({ how: 'How we turn one public input into one county rank', weights: 'Uninsured rate carries all 100 points in this version.' });
    const multi = [{ ...weight, points: 30 }, { ...weight, key: 'poverty_rate', label: 'Poverty rate', points: 30 }, { ...weight, key: 'no_vehicle_pct', label: 'No-vehicle households', points: 10 }];
    expect(headlines({ inputs: [input, input, input], weights: multi })).toMatchObject({ how: 'How we turn 3 public inputs into one county rank', weights: 'Uninsured rate and Poverty rate count most, at 30 of 100 points each.' });
    expect(headlines({ inputs: [input], weights: multi.slice(1) }).weights).toBe('Poverty rate counts most, at 30 of 100 points.');
    expect(headlines({ inputs: [], weights: [{ ...weight, points: null }] }).weights).toBe('Weights are not available yet.');
    expect(summary(view)).toEqual(['Version v2-synthetic, approved Oct 2026', 'one input, 100 points', '26 of 29 counties scored']);
  });
});
