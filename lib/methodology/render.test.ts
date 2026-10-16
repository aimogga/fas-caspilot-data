import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FormulaBlock, InputsTable, Sec, VersionLine, WeightCards } from '@/components/methodology';
import type { MethodologyView } from './query';
import { headlines, summary } from './words';

const input = { key: 'uninsured', label: 'Uninsured rate', known: true, source: 'Census SAHIE', vintage: '2023', asOf: 'Oct 2026', status: 'current' as const };
const view: MethodologyView = { version: 'v2-synthetic', approvedLabel: 'Oct 2026', synthetic: true, singleInput: true, draft: null, inputs: [input, { ...input, key: 'mystery', label: 'mystery', known: false, source: '—', vintage: '—', asOf: '—', status: 'not_published' }],
  weights: [{ key: 'uninsured', label: 'Uninsured rate', known: true, weight: '1', share: '100%', points: 100 }], sum: '1', mismatch: null, notPublished: '3 of 29 counties are Not published for this version.', footer: '', scored: 26, counties: 29 };
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('DS-16b methodology components render on the server', () => {
  it('weight cards read label, points, sentence and source line; the summary and headlines are in words', () => {
    const cards = text(renderToStaticMarkup(createElement(WeightCards, { view })));
    expect(cards).toMatch(/Uninsured rate .*100 of 100 points .*no health insurance.* Census SAHIE 2023 · as of Oct 2026 .*Total 1 of 100 points as stored, across one input\./);
    const line = text(renderToStaticMarkup(createElement(VersionLine, { lines: summary(view), synthetic: true })));
    expect(line).toMatch(/Version v2-synthetic, approved Oct 2026 · 2 inputs, 100 points · 26 of 29 counties scored .*Synthetic data/);
    const sec = renderToStaticMarkup(Sec({ id: 'how', eyebrow: 'How we calculate it', title: headlines(view).how, children: 'body' }));
    expect(sec).toMatch(/<p class="[^"]*uppercase[^"]*">How we calculate it<\/p><h2 id="how" tabindex="-1" class="[^"]*font-serif[^"]*">How we turn 2 public inputs into one county rank<\/h2>/);
  });
  it('inputs table: provenance on a loaded source, a hint on a never-loaded one, five hints in the plain paragraph', () => {
    const table = renderToStaticMarkup(createElement(InputsTable, { caption: 'Inputs', rows: view.inputs }));
    expect(table).toContain('Census SAHIE · 2023 · as of Oct 2026');
    expect(table).toContain('Unlabeled input');
    expect((table.match(/data-slot="hint-trigger"/g) ?? []).length).toBe(3);
    const formula = renderToStaticMarkup(createElement(FormulaBlock, { view }));
    expect((formula.match(/data-stat="/g) ?? []).length).toBe(5);
    expect(text(formula)).not.toMatch(/z_i,c is computed/);
  });
});
