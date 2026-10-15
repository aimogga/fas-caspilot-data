import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountyPanel, SELECT_PROMPT } from '@/components/need-map/CountyPanel';
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
});
