import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SELECT_PROMPT } from '@/components/need-map/CountyPanel';
import { NeedMap, summary } from '@/components/need-map/NeedMap';
import { RankedList } from '@/components/need-map/RankedList';
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
  it('draws 29 focusable labelled county buttons, hatches the 3 unscored and fills the rest by bin', () => {
    expect(count(html, /<path [^>]*data-fips="49\d{3}"[^>]*tabindex="0" role="button" aria-pressed="false" aria-label="[^"]+ County, [^"]+"[^>]*stroke="var\(--border\)" stroke-width="1"/g)).toBe(29);
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
    // DS-11b: the legend is in words, one Hint per line (band range and count, why hatched, what an FAS county is).
    expect(count(html, /<li[^>]*><button [^>]*data-slot="hint-trigger"[^>]*><span aria-hidden="true"[^>]*><\/span>(Lowest|Lower|Middle|Higher|Highest)( need)? · \d+ counties<\/button>/g)).toBe(5);
    for (const text of ['Not published · 3 counties', 'FAS county (outlined)', 'Placeholder bins (5 equal-count groups) until need-score weights are set.', 'Relative ranking, not absolute need.']) {
      expect(html).toContain(`${text}</`);
    }
    expect(summary(data.counties)).toBe('Highest need: Rich County, San Juan County, Sevier County. Lowest need: Morgan County, Kane County, Iron County. 3 counties not published.');
    expect(html).toMatch(/<svg [^>]*role="group" aria-label="Utah county need map" aria-describedby="need-map-summary"/);
  });

  it('prints rank labels where the county box is at least 24 px each way from 1024, hidden below; the hover card wrapper and hover stroke are there', () => {
    expect(count(html, /<text [^>]*class="hidden font-medium tabular-nums lg:block lg:text-xl min-\[1440px\]:text-base">\d+<\/text>/g)).toBe(26);
    expect(html).toMatch(/^<div data-slot="map-hover" class="relative"><figure/);
    expect(count(html, /<path [^>]*class="cursor-pointer hover:stroke-2 hover:stroke-foreground focus-visible:outline-2 focus-visible:outline-ring"/g)).toBe(29);
    expect(html).not.toContain('data-slot="map-hover-card"');
    expect(html).toMatch(/<text [^>]*fill="var\(--primary-foreground\)"[^>]*>1<\/text>/);
  });

  it('selected county: aria-pressed, a 3 px --ring outline above the FAS outlines, and the panel in the legend column', () => {
    expect(html).toContain(SELECT_PROMPT);
    expect(html).not.toContain('data-selected-outline=');
    const selected = data.counties.find((c) => c.fips === '49011') ?? null;
    const out = renderToStaticMarkup(createElement(NeedMap, { data, selected }));
    expect(count(out, /aria-pressed="true"/g)).toBe(1);
    expect(out).toMatch(/<path [^>]*data-fips="49011"[^>]*data-selected="true"[^>]*aria-pressed="true"/);
    expect(out).toMatch(/<path [^>]*data-selected-outline="49011" fill="none" stroke="var\(--ring\)" stroke-width="3" pointer-events="none" aria-hidden="true"/);
    expect(out.indexOf('data-selected-outline=')).toBeGreaterThan(out.lastIndexOf('data-fas-outline='));
    expect(out).toMatch(/<div class="order-last lg:order-none lg:col-span-5 lg:sticky lg:top-4 lg:self-start"><div[^>]*data-slot="county-panel"[^>]*>[^]*Davis County[^]*Rank <button[^>]*>20 of 26<\/button> · Need score <button[^>]*>−0\.80<\/button>[^]*<\/div><figcaption/);
    expect(out).not.toContain(SELECT_PROMPT);
  });

  it('?fas=1 greys non-FAS counties to --muted but keeps them focusable and labelled', () => {
    const dim = renderToStaticMarkup(createElement(NeedMap, { data: NeedMapQuery.build(input, { fas: true }), fas: true }));
    expect(count(dim, /<path [^>]*data-dim="true"[^>]*tabindex="0" role="button"[^>]*aria-label="[^"]+"[^>]*style="fill:var\(--muted\)"/g)).toBe(24);
    expect([count(dim, /<path [^>]*data-fips=/g), count(dim, /<path [^>]*data-fas-outline=/g), count(dim, /<text /g)]).toEqual([29, 5, 5]);
  });
});

describe('RankedList markup (DS-11b, below md)', () => {
  const list = renderToStaticMarkup(createElement(RankedList, { data }));
  it('is one 44 px link row per county, hidden from md up, with rank, name, score, band words, FAS badge and the hatch for no score', () => {
    expect(list).toMatch(/^<section data-slot="ranked-list" aria-labelledby="ranked-list-title" class="md:hidden"><h2 [^>]*>29 counties, highest need first<\/h2><p [^>]*>26 of 29 have a need score\. Tap a county/);
    expect(count(list, /<li data-fips="49\d{3}"><a aria-label="[^"]+" class="grid min-h-11 [^"]*" href="\?county=49\d{3}#county-panel">/g)).toBe(29);
    expect(list).toMatch(/<a aria-label="Davis County, rank 20 of 26, need score −0\.80, FAS county"[^>]*href="\?county=49011#county-panel"><span[^>]*>20<\/span><span[^>]*>Davis County<\/span><span[^>]*>−0\.80<\/span>/);
    expect(list).toMatch(/Davis County[^]*?data-slot="badge" data-variant="muted"[^>]*><span aria-hidden="true"[^>]*><\/span> Lowest need<\/span><span data-slot="badge" data-variant="info"[^>]*>[^]*? FAS county<\/span>/);
    expect(list).toMatch(/aria-label="Daggett County, not published"[^>]*><span[^>]*><span aria-hidden="true" [^>]*style="background-color:var\(--suppressed\);[^"]*"><\/span><\/span><span[^>]*>Daggett County<\/span>/);
    expect(list).toMatch(/Daggett County<\/span><span[^>]*><span[^>]*>Not published<\/span><\/span><span[^>]*>No need score<\/span>/);
    expect(renderToStaticMarkup(createElement(RankedList, { data: NeedMapQuery.build(input, { fas: true }), fas: true }))).toMatch(/5 counties, highest need first[^]*href="\?county=49035&amp;fas=1#county-panel"/);
  });
});
