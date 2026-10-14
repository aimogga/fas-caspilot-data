import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NeedMap, legendBins, summary } from '@/components/need-map/NeedMap';
import { COUNTIES } from '../synthetic/generate';
import { NeedBins } from './bins';
import { NeedMapQuery, type NeedInput } from './query';

const UNPUBLISHED = ['49009', '49031', '49055'];
/** Seed-shaped scores (supabase/seed.sql): 26 scored, Davis tied with Cache, 3 not published, 5 FAS counties. */
const seedScore = (fips: string): number => (fips === '49011' ? seedScore('49005') : ((Number(fips.slice(2)) * 7) % 29 - 14) / 10);
const input: NeedInput = {
  configs: [{ version: 'v2-synthetic', created_at: '2026-10-01', approved_by: 'u1' }],
  scores: COUNTIES.filter((c) => !UNPUBLISHED.includes(c.fips)).map((c) => ({ version: 'v2-synthetic', geo_fips: c.fips, score: seedScore(c.fips) })),
  indicators: [],
  sources: [],
  fas: ['49035', '49049', '49011', '49057', '49045'].map((fips) => ({ fips })),
};
const data = NeedMapQuery.build(input);
const html = renderToStaticMarkup(createElement(NeedMap, { data }));
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
/** DS-06 L52: `--chart-1` at these steps for bins 1–5. */
const RAMP = [15, 35, 55, 75, 100];
const scored = (scores: number[]) => NeedBins.assign(scores.map((score, i) => ({ fips: `f${i}`, score })));

describe('NeedBins ties', () => {
  // Rule: tied scores share one bin, the bin of the tie's first (lowest) sorted position, so a tie never straddles a boundary.
  it('puts equal scores in the same bin, even when they straddle a quantile boundary', () => {
    expect([...scored([1, 2, 3, 3, 5, 6, 7, 8, 9, 10]).values()]).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect([...scored([1, 2, 3, 4, 4, 6, 7, 8, 9, 10]).values()]).toEqual([1, 1, 2, 2, 2, 3, 4, 4, 5, 5]);
    const [davis, cache] = ['49011', '49005'].map((fips) => data.counties.find((c) => c.fips === fips));
    expect([davis?.binNo, davis?.rank]).toEqual([cache?.binNo, cache?.rank]);
  });
});

describe('NeedMap markup', () => {
  it('draws 29 focusable labelled county paths, hatches the 3 unscored and fills the rest by bin', () => {
    expect(count(html, /<path [^>]*data-fips="49\d{3}"[^>]*tabindex="0" role="img" aria-label="[^"]+ County, [^"]+"[^>]*stroke="var\(--border\)" stroke-width="1"/g)).toBe(29);
    expect(count(html, /<path [^>]*data-bin="0"[^>]*aria-label="[^"]+ County, not published"[^>]*style="fill:url\(#need-map-hatch\)"/g)).toBe(3);
    expect(html).toMatch(/<pattern id="need-map-hatch"[^>]*><rect [^>]*fill="var\(--suppressed\)"/);
    const bins = [...NeedBins.assign(data.counties.map((c) => ({ fips: c.fips, score: c.value }))).values()];
    for (const bin of [1, 2, 3, 4, 5]) {
      const fill = `style="fill:color-mix\\(in oklch, var\\(--chart-1\\) ${RAMP[bin - 1]}%, transparent\\)"`;
      expect([bin, count(html, new RegExp(`<path [^>]*data-bin="${bin}"[^>]*${fill}`, 'g'))]).toEqual([bin, bins.filter((b) => b === bin).length]);
    }
    expect(html).toContain('aria-label="Davis County, rank 20 of 26, need score −0.80, FAS county"');
    expect(html).toContain('aria-label="Daggett County, not published"');
  });

  it('outlines the 5 FAS counties in a second pass above the fills', () => {
    expect(count(html, /<path [^>]*data-fas-outline="49\d{3}"[^>]*stroke="var\(--foreground\)" stroke-width="2"[^>]*aria-hidden="true"/g)).toBe(5);
    expect(html.indexOf('data-fas-outline=')).toBeGreaterThan(html.lastIndexOf('data-fips='));
  });

  it('prints the legend copy exactly, with numeric bin ranges, and the map summary', () => {
    expect(html).toMatch(/<figcaption data-slot="map-legend"[^>]*><p[^>]*>Need score \(version v2-synthetic\) · Placeholder bins<\/p><ul/);
    expect(legendBins(data.counties)).toEqual(['Lowest −1.40 to −0.80', 'Lower −0.70 to −0.30', 'Middle −0.20 to +0.30', 'Higher +0.40 to +0.90', 'Highest +1.00 to +1.40']);
    for (const text of ['Not published', 'FAS county (outlined)', 'Placeholder bins (5 equal-count groups) until need-score weights are set.', 'Relative ranking, not absolute need.']) {
      expect(html).toContain(`${text}</`);
    }
    expect(summary(data.counties)).toBe('Highest need: Rich County, San Juan County, Sevier County. Lowest need: Morgan County, Kane County, Iron County. 3 counties not published.');
    expect(html).toMatch(/<svg [^>]*role="group" aria-label="Utah county need map" aria-describedby="need-map-summary"/);
  });

  it('prints rank labels only where the county box is at least 28 px each way, hidden below 1440', () => {
    expect(count(html, /<text [^>]*class="hidden font-mono tabular-nums min-\[1440px\]:block">\d+<\/text>/g)).toBe(26);
    expect(html).toMatch(/<text [^>]*fill="var\(--primary-foreground\)"[^>]*>1<\/text>/);
  });

  it('?fas=1 greys non-FAS counties to --muted but keeps them focusable and labelled', () => {
    const dim = renderToStaticMarkup(createElement(NeedMap, { data: NeedMapQuery.build(input, { fas: true }), fas: true }));
    expect(count(dim, /<path [^>]*data-dim="true"[^>]*tabindex="0" role="img" aria-label="[^"]+"[^>]*style="fill:var\(--muted\)"/g)).toBe(24);
    expect([count(dim, /<path [^>]*data-fips=/g), count(dim, /<path [^>]*data-fas-outline=/g), count(dim, /<text /g)]).toEqual([29, 5, 5]);
  });
});
