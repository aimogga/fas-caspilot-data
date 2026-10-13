import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountyPanel, SELECT_PROMPT } from '@/components/need-map/CountyPanel';
import type { Column, CountyRow } from './query';

const columns: Column[] = [{ code: 'uninsured_rate', label: 'Uninsured rate', note: 'Census SAHIE 2024' }, { code: 'poverty_count', label: 'In poverty', note: 'Census SAIPE 2023' }];
const sources = [{ code: 'uninsured_rate', name: 'Census SAHIE', vintage: '2024', asOf: 'Oct 2026' }, { code: 'poverty_count', name: 'Census SAIPE', vintage: '2023', asOf: 'Sep 2026' }];
const row = (over: Partial<CountyRow> = {}): CountyRow => ({ fips: '49035', name: 'Salt Lake County', fas: true, rank: '1 of 26', score: '+1.74', bin: '5 of 5', status: 'Ranked', value: 1.74, binNo: 5,
  cells: { uninsured_rate: '9.2% ± 0.5', poverty_count: 'Not published' }, ...over });
const html = (county: CountyRow | null) => renderToStaticMarkup(createElement(CountyPanel, { county, columns, version: 'v2', rankedCount: 26, sources }));

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
    expect(out).toContain('Rank 1 of 26 · Need score +1.74');
    expect(out).toContain('Uninsured rate');
    expect(out).toContain('9.2% ± 0.5');
    expect(out).toContain('Census SAHIE · 2024 · as of Oct 2026');
    expect(out).toContain('Census SAIPE · 2023 · as of Sep 2026');
    expect(out).toMatch(/tabular-nums[^>]*>9\.2% ± 0\.5/);
    expect(out).toMatch(/text-right[^>]*tabular-nums/);
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
    expect(out).toContain('Rank Not published · Need score Not published');
  });
});
