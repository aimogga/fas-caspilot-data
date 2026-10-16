import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountyPanel, SELECT_PROMPT, TOP_PROMPT } from '@/components/need-map/CountyPanel';
import type { Column, CountyRow } from './query';

const columns: Column[] = [{ code: 'uninsured_rate', label: 'Uninsured rate', note: 'Census SAHIE 2024', unit: 'percent' }, { code: 'poverty_count', label: 'In poverty', note: 'Census SAIPE 2023', unit: 'count' }];
const sources = [{ code: 'uninsured_rate', name: 'Census SAHIE', vintage: '2024', asOf: 'Oct 2026' }, { code: 'poverty_count', name: 'Census SAIPE', vintage: '2023', asOf: 'Sep 2026' }];
const row = (over: Partial<CountyRow> = {}): CountyRow => ({ fips: '49035', name: 'Salt Lake County', fas: true, rank: '1 of 26', score: '+1.74', bin: '5 of 5', status: 'Ranked', value: 1.74, binNo: 5,
  cells: { uninsured_rate: '9.2% ± 0.5', poverty_count: 'Not published' }, values: { uninsured_rate: 9.2, poverty_count: null }, ...over });
const html = (county: CountyRow | null) => renderToStaticMarkup(createElement(CountyPanel, { county, columns, version: 'v2', rankedCount: 26, sources }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

describe('CountyPanel', () => {
  it('prompts for a selection when empty', () => {
    const out = html(null);
    expect(out).toContain(SELECT_PROMPT);
    expect(out).toContain('data-slot="county-panel"');
    expect(out).toContain('aria-labelledby="county-panel-title"');
    expect(out).not.toContain('Rank ');
  });

  it('shows the FAS badge, rank line, indicator rows and footers', () => {
    const out = html(row());
    expect(out).toContain('Salt Lake County');
    expect(out).toContain('FAS county');
    expect(text(out)).toContain('Rank 1 of 26 · Need score +1.74');
    expect(out).toContain('Uninsured rate');
    expect(text(out)).toContain('9.2%± 0.5');
    expect(out).toContain('Census SAHIE · 2024 · as of Oct 2026');
    expect(out).toContain('Census SAIPE · 2023 · as of Sep 2026');
    expect(out).toMatch(/tabular-nums[^>]*>9\.2%<button[^>]*data-slot="hint-trigger"/);
    expect(out).toMatch(/text-right[^>]*tabular-nums/);
  });

  it('DS-11a: indicator footers are Provenance triggers, the margin of error has a Hint, and the rank line explains itself', () => {
    const out = html(row());
    expect(out).toMatch(/data-slot="source-footer"[^>]*><button[^>]*data-slot="explain-trigger"[^>]*>Census SAHIE · 2024 · as of Oct 2026</);
    expect((out.match(/data-slot="explain-trigger"/g) ?? []).length).toBe(2 + columns.length * 2);
    expect((out.match(/data-slot="hint-trigger"/g) ?? []).length).toBe(1);
  });

  it('explains a Not published cell with both sentences', () => {
    const out = html(row());
    expect(out).toContain('>Not published<');
    expect(out).toContain('Census SAIPE did not publish this for Salt Lake County in 2023.');
    expect(out).not.toContain('Census SAHIE did not publish');
  });

  it('omits the badge for a non-FAS county and shows Not published when unscored', () => {
    const out = html(row({ name: 'Kane County', fas: false, rank: 'Not published', score: 'Not published', status: 'Not published' }));
    expect(out).not.toContain('FAS county');
    expect(text(out)).toContain('Rank Not published · Need score Not published');
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
