import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CountyPanel, SELECT_PROMPT, TOP_PROMPT } from '@/components/need-map/CountyPanel';
import type { Column, CountyRow } from './query';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => '/need-map', useSearchParams: () => new URLSearchParams() }));

const SAIPE = { name: 'Census SAIPE', vintage: '2023', asOf: 'Sep 2026' };
const columns: Column[] = [{ code: 'child_poverty_rate', label: 'Child poverty rate', note: 'Census SAIPE 2023', unit: 'percent' }, { code: 'poverty_count', label: 'In poverty', note: 'Census SAIPE 2023', unit: 'count' },
  { code: 'poverty_rate', label: 'Poverty rate', note: 'Census SAIPE 2023', unit: 'percent' }, { code: 'uninsured_rate', label: 'Uninsured rate', note: 'Census SAHIE 2024', unit: 'percent' }];
const sources = [{ code: 'uninsured_rate', name: 'Census SAHIE', vintage: '2024', asOf: 'Oct 2026' }, ...['child_poverty_rate', 'poverty_count', 'poverty_rate'].map((code) => ({ code, ...SAIPE }))];
const row = (over: Partial<CountyRow> = {}): CountyRow => ({ fips: '49035', name: 'Salt Lake County', fas: true, rank: '1 of 26', score: '+1.74', bin: '5 of 5', status: 'Ranked', value: 1.74, binNo: 5,
  cells: { uninsured_rate: '9.2% ± 0.5', poverty_rate: '8% ± 0.4', child_poverty_rate: 'Not published', poverty_count: 'Not published' },
  values: { uninsured_rate: 9.2, poverty_rate: 8, child_poverty_rate: null, poverty_count: null }, ...over });
const counties = [row(), row({ fips: '49001', binNo: 1, values: { uninsured_rate: 5, poverty_rate: 6 } }), row({ fips: '49003', binNo: 3, values: { uninsured_rate: 7, poverty_rate: 9 } })];
const html = (county: CountyRow | null) => renderToStaticMarkup(createElement(CountyPanel, { county, columns, version: 'v2', rankedCount: 26, sources, counties }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

describe('CountyPanel', () => {
  it('prompts for a selection when empty', () => {
    const out = html(null);
    expect(out).toContain(SELECT_PROMPT);
    expect(out).toContain('data-slot="county-panel"');
    expect(out).toContain('aria-labelledby="county-panel-title"');
    expect(out).not.toContain('Rank ');
  });

  it('DS-22: the picker sits above the name in both states, labelled, with the selected county as its value', () => {
    const options = [{ value: '49001', label: 'Beaver County' }, { value: '49035', label: 'Salt Lake County' }];
    const render = (county: CountyRow | null) => renderToStaticMarkup(createElement(CountyPanel, { county, columns, version: 'v2', rankedCount: 26, sources, counties, options }));
    for (const county of [null, row()]) {
      const out = render(county);
      expect(out).toMatch(/data-slot="county-picker"[^]*<label for="county-picker"[^>]*>Choose a county<\/label><select id="county-picker"[^>]*><option value=""[^>]*>Select a county…<\/option><option value="49001"[^>]*>Beaver County<\/option>[^]*<h2 id="county-panel-title"/);
    }
    expect(render(row())).toMatch(/<option value="49035" selected=""/);
  });

  it('DS-20b: the header says the rank in words with the band, the rank and score explain themselves, and the FAS badge stays', () => {
    const out = html(row({ rank: '3 of 26' }));
    expect(out).toMatch(/<h2 id="county-panel-title"[^>]*>Salt Lake County<span[^>]*data-slot="badge"[^]*?FAS county<\/span><\/h2>/);
    expect(out).toMatch(/data-slot="rank-line"[^>]*><p class="[^"]*font-serif text-xl[^"]*"><button[^>]*data-slot="explain-trigger"[^>]*>3rd highest need<\/button> of 26 counties scored · Highest need band<\/p>/);
    expect(text(out)).toContain('Need score +1.74 · version v2');
    expect(out).toMatch(/Need score <button[^>]*data-slot="explain-trigger"[^>]*>\+1\.74<\/button>/);
    expect(html(row())).toContain('>Highest need</button> of 26 counties scored');
    expect(out).toContain('data-slot="county-compare"');
  });

  it('DS-20b: key measures are only the scored rates, in key order, each with the value and how many counties it beats', () => {
    const out = html(row());
    const key = out.slice(out.indexOf('data-slot="key-measures"'), out.indexOf('data-slot="all-measures"'));
    expect([...key.matchAll(/<li data-where="\w+"[^>]*><span class="truncate">([^<]+)</g)].map((m) => m[1])).toEqual(['Uninsured rate', 'Poverty rate']);
    expect(text(key)).toContain('Key measures');
    expect(text(key)).toMatch(/Uninsured rate9\.2%, above the state median of 7%, higher than 2 of 2 other countiesHigher than 2 of 2 other counties · state median 7%/);
    expect(key).not.toContain('Child poverty rate');
    expect(key).not.toContain('In poverty');
  });

  it('DS-20b: all measures sit in a closed disclosure, grouped by source with one source line per group; each label keeps its card and the margin its hint', () => {
    const out = html(row());
    expect(out).toMatch(/<details data-slot="all-measures"[^>]*><summary class="[^"]*min-h-11[^"]*">[^]*?All measures \(4\)<\/summary>/);
    expect(out).not.toMatch(/<details[^>]* open/);
    const groups = [...out.matchAll(/data-slot="measure-group"[^>]*><h3[^>]*>([^<]+)<\/h3><p data-slot="source-footer"[^>]*><button[^>]*data-slot="explain-trigger"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]);
    expect(groups).toEqual([['Health coverage', 'Census SAHIE 2024 · as of Oct 2026'], ['Poverty', 'Census SAIPE 2023 · as of Sep 2026']]);
    expect((out.match(/data-slot="source-footer"/g) ?? []).length).toBe(2);
    expect(out.match(/data-slot="panel-indicator"[^]*?<\/div>/g)?.every((r) => !r.includes('source-footer'))).toBe(true);
    expect(text(out)).toMatch(/PovertyCensus SAIPE 2023 · as of Sep 2026Poverty rate8%± 0\.4Child poverty rateNot publishedCensus SAIPE did not publish this for Salt Lake County in 2023\.In povertyNot published/);
    expect(out).toMatch(/tabular-nums[^>]*>9\.2%<button[^>]*data-slot="hint-trigger"/);
    expect((out.match(/data-slot="explain-trigger"/g) ?? []).length).toBe(2 + 2 + columns.length);
    expect((out.match(/data-slot="hint-trigger"/g) ?? []).length).toBe(3);
  });

  it('DS-20a: before a pick, "Highest need" lists the top rows as links with rank and score explained, the FAS badge, and the prompt', () => {
    const top = [row(), row({ fips: '49043', name: 'Summit County', fas: false, rank: '2 of 26', score: '+1.20', binNo: 5 })];
    const out = renderToStaticMarkup(createElement(CountyPanel, { county: null, columns, version: 'v2', rankedCount: 26, sources, top }));
    expect(out).toMatch(/<h2 id="county-panel-title"[^>]*>Highest need</);
    expect(out).toContain(TOP_PROMPT);
    expect(out).not.toContain(SELECT_PROMPT);
    expect((out.match(/<li data-fips="49\d{3}"/g) ?? []).length).toBe(2);
    expect(out).toMatch(/<li data-fips="49035"[^>]*><span tabindex="-1" data-term="rank" data-value="1 of 26" data-source="Need score version v2"[^>]*>1<\/span><a [^>]*href="\?county=49035"/);
    expect(out).toMatch(/aria-label="Salt Lake County, rank 1 of 26, need score \+1\.74, FAS county"/);
    expect(out).toMatch(/data-term="need_score" data-value="\+1\.74"[^>]*>\+1\.74<\/span>/);
    expect(out).toMatch(/data-term="fas_county"[^>]*>[^]*? FAS county<\/span><\/a>/);
    expect(out).toMatch(/Summit County<\/span><\/a>/);
    expect((out.match(/data-slot="explain-trigger"[^>]*>(Rank|Need score)</g) ?? []).length).toBe(2);
    expect(out).toContain('data-slot="explain-layer"');
  });

  it('DS-20a: with ?fas=1 the list is titled for FAS counties and its links keep the filter; with no ranked county the old prompt stays', () => {
    const out = renderToStaticMarkup(createElement(CountyPanel, { county: null, columns, version: 'v2', rankedCount: 26, sources, top: [row()], fas: true }));
    expect(out).toMatch(/>Highest need among FAS counties</);
    expect(out).toContain('href="?county=49035&amp;fas=1"');
    const none = renderToStaticMarkup(createElement(CountyPanel, { county: null, columns, version: 'v2', rankedCount: 0, sources, top: [] }));
    expect(none).toContain(SELECT_PROMPT);
    expect(none).not.toContain('Highest need');
  });
  it('DS-20a: before a pick, "Highest need" lists the top rows as links with rank and score explained, the FAS badge, and the prompt', () => {
    const top = [row(), row({ fips: '49043', name: 'Summit County', fas: false, rank: '2 of 26', score: '+1.20', binNo: 5 })];
    const out = renderToStaticMarkup(createElement(CountyPanel, { county: null, columns, version: 'v2', rankedCount: 26, sources, top }));
    expect(out).toMatch(/<h2 id="county-panel-title"[^>]*>Highest need</);
    expect(out).toContain(TOP_PROMPT);
    expect(out).not.toContain(SELECT_PROMPT);
    expect((out.match(/<li data-fips="49\d{3}"/g) ?? []).length).toBe(2);
    expect(out).toMatch(/<li data-fips="49035"[^>]*><span tabindex="-1" data-term="rank" data-value="1 of 26" data-source="Need score version v2"[^>]*>1<\/span><a [^>]*href="\?county=49035"/);
    expect(out).toMatch(/aria-label="Salt Lake County, rank 1 of 26, need score \+1\.74, FAS county"/);
    expect(out).toMatch(/data-term="need_score" data-value="\+1\.74"[^>]*>\+1\.74<\/span>/);
    expect(out).toMatch(/data-term="fas_county"[^>]*>[^]*? FAS county<\/span><\/a>/);
    expect(out).toMatch(/Summit County<\/span><\/a>/);
    expect((out.match(/data-slot="explain-trigger"[^>]*>(Rank|Need score)</g) ?? []).length).toBe(2);
    expect(out).toContain('data-slot="explain-layer"');
  });

  it('DS-20a: with ?fas=1 the list is titled for FAS counties and its links keep the filter; with no ranked county the old prompt stays', () => {
    const out = renderToStaticMarkup(createElement(CountyPanel, { county: null, columns, version: 'v2', rankedCount: 26, sources, top: [row()], fas: true }));
    expect(out).toMatch(/>Highest need among FAS counties</);
    expect(out).toContain('href="?county=49035&amp;fas=1"');
    const none = renderToStaticMarkup(createElement(CountyPanel, { county: null, columns, version: 'v2', rankedCount: 0, sources, top: [] }));
    expect(none).toContain(SELECT_PROMPT);
    expect(none).not.toContain('Highest need');
  });
});
