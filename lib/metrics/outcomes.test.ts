import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generate } from '@/lib/synthetic/generate';
import { type MeasureResult, type OutcomeRow, Outcomes } from './outcomes';

const golden = JSON.parse(readFileSync('tests/golden/outcomes.json', 'utf8')) as {
  seed: number; nCases: number; measures: MeasureResult[];
};
const rows = generate(golden.seed, golden.nCases).outcome_measure as unknown as OutcomeRow[];
const row = (code: string, b: number | null, f: number | null, d?: string): OutcomeRow =>
  ({ measure_code: code, baseline_score: b, followup_score: f, followup_date: d ?? '2024-06-01' });

describe('golden: outcomes fixture', () => {
  const all = Outcomes.compute(rows, { includeInactive: true });
  for (const g of golden.measures) {
    it(`${g.code}: n=${g.n}, mean ${g.meanChange}, share improved ${g.shareImproved}`, () => {
      expect(all.measures.find((m) => m.code === g.code)).toEqual(g);
    });
  }
  it('returns the 4 registry instruments in registry order and nothing unknown', () => {
    expect(all.measures.map((m) => m.code)).toEqual(['PHQ-9', 'GAD-7', 'OQ-45', 'YOQ']);
    expect(all.excludedUnknown).toBe(0);
  });
});

describe('unit: O1 compute', () => {
  it('returns only active instruments (PHQ-9, GAD-7) by default; measures opt narrows further', () => {
    expect(Outcomes.compute(rows).measures.map((m) => m.code)).toEqual(['PHQ-9', 'GAD-7']);
    expect(Outcomes.compute(rows, { measures: ['GAD-7'] }).measures.map((m) => m.code)).toEqual(['GAD-7']);
  });

  it('excludes and counts unknown codes; excludes rows with a null score', () => {
    const r = Outcomes.compute([row('PHQ-9', 10, 6), row('BDI', 10, 4), row('BDI', 9, 9), row('PHQ-9', null, 5), row('PHQ-9', 7, null)]);
    expect(r.excludedUnknown).toBe(2);
    expect(r.measures[0]).toMatchObject({ code: 'PHQ-9', n: 1, meanChange: -4, shareImproved: 1, improved: 1 });
  });

  it('n = 0 gives null mean and share with zero counts', () => {
    expect(Outcomes.compute([]).measures[1]).toEqual({
      code: 'GAD-7', label: 'GAD-7', direction: 'lower_is_better', n: 0, meanChange: null, shareImproved: null, improved: 0, unchanged: 0, worsened: 0,
    });
  });

  it('rounds mean and share to 4 dp and classifies improved/unchanged/worsened by direction', () => {
    const r = Outcomes.compute([row('PHQ-9', 10, 9), row('PHQ-9', 10, 10), row('PHQ-9', 10, 12)]).measures[0]!;
    expect(r).toMatchObject({ n: 3, meanChange: 0.3333, shareImproved: 0.3333, improved: 1, unchanged: 1, worsened: 1 });
  });

  it('date filter is inclusive on followup_date', () => {
    const r = Outcomes.compute(
      [row('PHQ-9', 10, 8, '2024-03-31'), row('PHQ-9', 10, 6, '2024-04-01'), row('PHQ-9', 10, 4, '2024-06-30'), row('PHQ-9', 10, 2, '2024-07-01')],
      { filters: { from: '2024-04-01', to: '2024-06-30' } },
    ).measures[0]!;
    expect(r).toMatchObject({ n: 2, meanChange: -5 });
  });
});

describe('unit: suppression (F-306)', () => {
  const nRows = (n: number) => Array.from({ length: n }, () => row('PHQ-9', 10, 8));
  it('hides mean and share when n < 11 and shows them at 11', () => {
    const [hid] = Outcomes.suppressed(Outcomes.compute(nRows(10))).measures;
    expect(hid).toMatchObject({ n: 10, meanChange: null, shareImproved: null, suppressed: true });
    const [shown] = Outcomes.suppressed(Outcomes.compute(nRows(11))).measures;
    expect(shown).toMatchObject({ n: 11, meanChange: -2, shareImproved: 1, suppressed: false });
    expect(Outcomes.suppressed(Outcomes.compute(nRows(5)), 5).measures[0]!.suppressed).toBe(false);
  });
});
