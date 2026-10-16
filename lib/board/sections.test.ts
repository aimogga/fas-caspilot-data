import { describe, expect, it } from 'vitest';
import type { DashboardMetrics } from '@/lib/dashboard/metrics-query';
import { boardCounties } from './counties';
import { boardSections, LEAD } from './sections';
import { sourcesParagraph } from './sources';
const w = <T>(v: T, n: number, delta: string | null = null) => ({ ...v, n, rows: n, viewRows: n, asOf: 'Sep 2026', delta });
const metrics = {
  m1: w({ median: 23 }, 12, '↓ 4 days faster than Q2'), m2: w({ median: 7 }, 19), m3: w({ share: null, topReason: null }, 17), m5: w({ costPerCompleted: 487 }, 33),
  m4: w({ total: { completed: 33, closed: 38, rate: 0.87 }, includesHiddenBands: true, rows: [] }, 38), m6: { error: true as const },
  o1: w({ measures: [{ code: 'GAD-7', label: 'GAD-7', n: 13, meanChange: 0.7, shareImproved: 0.23 }] }, 21), trend: [], trends: { m1: [], m2: [], m3: [], m5: [] }, filtered: false,
} as unknown as DashboardMetrics;
const none = boardCounties(null);
describe('board sections (DS-13b)', () => {
  it('opens each section with its summary sentence; a failed view is an error, nothing loaded is not available, and no picture is listed for either', () => {
    const s = boardSections(metrics, none);
    expect(s.map((x) => [x.no, x.question, x.state])).toEqual([[1, 'Did families improve?', 'value'], [2, 'How long families waited', 'value'], [3, 'Where our therapy dollars went', 'error'], [4, 'Need in the counties we serve', 'not-available']]);
    expect(s[0]).toMatchObject({ finding: 'Across all income bands, 87% of closed cases finished therapy (33 of 38); bands with fewer than 11 cases are hidden.', pictures: ['completion', 'outcomes'] });
    expect(s[1]).toMatchObject({ finding: 'Families referred by a court waited a median of 23 days for a first session, 4 days faster than the quarter before.', support: 'Funding decisions took a median of 7 days from application.', pictures: ['wait'] });
    expect(s[2]).toMatchObject({ finding: 'Not available yet', support: 'This number could not be loaded, so nothing is shown until the next try.', pictures: [] });
    expect(s[3]).toMatchObject({ finding: 'County need is not available yet.', support: 'This number appears once the data behind it is set up.' });
    expect(boardSections(null, none).map((x) => x.state)).toEqual(['not-available', 'not-available', 'not-available', 'not-available']);
    expect(LEAD).toMatch(/^Four pictures tell the quarter/);
  });
  it('writes the sources paragraph from the same n and as-of as the footers, skipping failed views and never a bare code', () => {
    const p = sourcesParagraph(metrics, '2026-Q3', 'Sep 2026', none);
    expect(p).toBe('FAS records for July–September 2026, as of Sep 2026: first sessions after a court order (n = 12), funding decisions (n = 19), approved families (n = 17), closed cases (n = 38), '
      + 'completed courses of therapy (n = 33), follow-up scores (n = 21). County need: not available yet. Counts under 11 families are hidden to protect privacy, and a neighbouring value is hidden '
      + 'when a small count could be worked out from a total. Dates are shown by quarter.');
    expect(p).not.toMatch(/\b[MO]\d\b|therapy episodes/);
    expect(sourcesParagraph(null, '2026-Q3', 'Not available yet', none)).toMatch(/^FAS records for this quarter are not available yet\. County need: not available yet\./);
  });
});
