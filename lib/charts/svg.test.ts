import { describe, expect, it } from 'vitest';
import type { Picture } from '@/lib/board/pictures';
import { barSvg, lineSvg, pictureCaption, pictureSvg, svgHeight, SVG_WIDTH } from './svg';
const bar: Picture = { id: 'completion', kind: 'bar', eyebrow: 'Who finishes therapy', noun: 'completion rate', unit: '%', valueHead: 'Finished', include: [100], n: 40, asOf: 'Jul 2026',
  headline: 'Under $30k finished therapy most often (90%), then $30k–$60k (82%). 1 of 3 bands hidden to protect privacy.', reference: { value: 85, label: 'All bands' },
  points: [{ label: 'Under $30k', value: 90 }, { label: '$30k–$60k', value: 82 }, { label: 'Over $60k', value: null, note: 'Fewer than 11 cases' }] };
const line: Picture = { id: 'wait', kind: 'line', eyebrow: 'Wait for a first session', noun: 'Days to first session', unit: ' days', valueHead: 'Median days', n: 12, asOf: 'Jul 2026',
  points: [{ label: 'Q4 ’25', value: 34 }, { label: 'Q1 ’26', value: null }, { label: 'Q2 ’26', value: 27 }, { label: 'Q3 ’26', value: 23 }] };
/** Every tag carries each attribute once: a repeated attribute is malformed XML and LibreOffice/Word reject the whole picture. */
const wellFormed = (svg: string) => { for (const tag of svg.match(/<[a-z]+[^>]*>/g) ?? []) { const names = [...tag.matchAll(/ ([a-zA-Z:-]+)="/g)].map((m) => m[1]); expect(new Set(names).size, tag).toBe(names.length); } };
describe('picture SVG for the DOCX', () => {
  it('is well-formed XML: no tag repeats an attribute (LibreOffice rejected the first draft for that)', () => { wellFormed(barSvg(bar)); wellFormed(lineSvg(line)); });
  it('bars: one rect per shown row, a hatched band and the words for a hidden row, the value labels, the reference line and its label', () => {
    const svg = barSvg(bar);
    expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${svgHeight(bar)}"`)).toBe(true);
    expect(svg.match(/fill="#2e5e48"/g)?.length).toBe(2);
    expect(svg).toContain('fill="url(#hatch)"');
    for (const t of ['Under $30k', '90%', '82%', 'Hidden (n &lt; 11)', 'All bands 85%', 'stroke-dasharray']) expect(svg).toContain(t);
    expect(svg).not.toMatch(/NaN|undefined/);
  });
  it('line: known runs of two or more as polylines (a lone point before a hidden quarter is a dot only), end labels, a hatched band, every quarter label', () => {
    const svg = lineSvg(line);
    expect(svg.match(/<polyline/g)?.length).toBe(1);
    expect(svg.match(/<circle/g)?.length).toBe(3);
    expect(svg.match(/url\(#hatch\)/g)?.length).toBe(1);
    for (const t of ['34 days', '23 days', 'Q1 ’26', 'Q3 ’26']) expect(svg).toContain(t);
    expect(svg).not.toMatch(/NaN|undefined/);
    expect(pictureSvg(line)).toBe(svg);
  });
  it('captions: the bar headline, or the line summary; a line with every quarter hidden still renders', () => {
    expect(pictureCaption(bar)).toBe(bar.headline);
    expect(pictureCaption(line)).toBe('Days to first session fell from 34 days to 23 days over 4 periods (Q4 ’25 to Q3 ’26)');
    expect(lineSvg({ ...line, points: line.points.map((p) => ({ ...p, value: null })) })).toContain('Hidden (n &lt; 11)');
  });
});
