import { describe, expect, it } from 'vitest';
import { HIDDEN_SMALL } from '@/lib/trust/glossary';
import type { Figure, Packet } from './model';
import { CONTROL_HINTS, DOWNLOAD_HINTS, figureCell, figureTerm, figureTermId, packetTerms, sectionEyebrow, sectionLead } from './words';

const fig = (label: string, value: string, sourceLabel = 'FAS records · Jul–Sep 2024 (Q3)', asOf = 'Oct 2024'): Figure => ({ label, value, kind: 'value', sourceLabel, asOf });
const packet = (figures: Figure[]): Packet => ({ sections: [{ id: 'fas-results', title: 'FAS results', paragraphs: [], figures, source: '' }] } as unknown as Packet);

describe('DS-17 packet words', () => {
  it('AC1: figureCell carries term, value, source and as-of; hidden figures carry the reason and never a value', () => {
    expect(figureCell(fig('Days from court order to first session', '23 days'))).toEqual({ 'data-term': 'm1', 'data-value': '23 days', 'data-source': 'FAS records · Jul–Sep 2024 (Q3)', 'data-asof': 'Oct 2024', 'data-hidden': undefined });
    expect(figureCell(fig('Days from application to funding decision', 'fewer than 11'))).toMatchObject({ 'data-term': 'm2', 'data-value': undefined, 'data-hidden': HIDDEN_SMALL });
    expect(figureCell(fig('Completion rate by income band', 'hidden'))['data-hidden']).toMatch(/^Hidden so the smaller group/);
    expect(figureCell(fig('Uninsured rate', 'Not available yet', 'Census SAHIE 2023'))).toMatchObject({ 'data-term': 'ind:uninsured_rate', 'data-value': undefined, 'data-hidden': 'This number appears once the data behind it is set up.' });
  });
  it('AC1: term ids resolve metrics, outcomes, rates, weights, counties and indicators; unknown labels get a fallback titled with the label', () => {
    const ids = [fig('Share of dollars to affiliated providers', '40%'), fig('Affiliated providers average rate per hour', '$120'), fig('PHQ-9 mean change', '−2.1'), fig('PHQ-9 share improved', '60%'),
      fig('Poverty rate', 'weight 0.3 (30%)', 'Census SAIPE 2023'), fig('Service counties', 'Davis, Salt Lake'), fig('Veterans', '1,200', 'Census ACS 5-year 2022'), fig('Something new', '7')].map(figureTermId);
    expect(ids).toEqual(['m6', 'rate_per_hour', 'o1_change', 'o1_improved', 'weight', 'service_counties', 'ind:veteran_population', 'fig:Something new']);
    const terms = packetTerms(packet([fig('Something new', '7'), fig('Poverty rate', '9%', 'Census SAIPE 2023')]));
    expect(terms['fig:Something new']).toMatchObject({ title: 'Something new', plain: /^A public measure for this county/ });
    expect(terms['ind:poverty_rate']?.title).toBe('Poverty rate');
    expect(terms.o1_improved?.title).toBe('Families who improved');
    expect(figureTerm(fig('Cost per completed episode', '$900')).title).toBe('Cost per completed episode');
    expect(figureTerm(fig('Something new', '7')).title).toBe('Something new');
    for (const t of Object.values(terms)) expect(t.plain).not.toMatch(/\b(M[1-6]|O1|pct|FIPS|MOE)\b/);
  });
  it('AC4: the eyebrow numbers the section and the headline is the first sentence, with the rest kept as body', () => {
    expect(sectionEyebrow(1, 6, 'FAS results')).toBe('Section 2 of 6 · FAS results');
    expect(sectionLead(['Need score version v2, approved Oct 2026: a weighted score (weights sum to 1). Synthetic placeholder weights are in use.', 'FAS results cover Jul–Sep 2026.']))
      .toEqual({ lead: 'Need score version v2, approved Oct 2026: a weighted score (weights sum to 1).', body: ['Synthetic placeholder weights are in use.', 'FAS results cover Jul–Sep 2026.'] });
    expect(sectionLead(['Each completed course of therapy cost $1,200 on average.'])).toEqual({ lead: 'Each completed course of therapy cost $1,200 on average.', body: [] });
    expect(sectionLead([])).toEqual({ lead: '', body: [] });
  });
  it('AC3: control and download hints are one or two plain sentences without codes', () => {
    for (const s of [...Object.values(CONTROL_HINTS), ...Object.values(DOWNLOAD_HINTS)]) {
      expect(s.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
      expect(s).not.toMatch(/\b(M[1-6]|O1|pct|FIPS|CSV appendix|N\/A)\b|!/);
    }
    expect(DOWNLOAD_HINTS.docx).toMatch(/month or quarter only/);
    expect(DOWNLOAD_HINTS.csv).toMatch(/month or quarter only/);
  });
});
