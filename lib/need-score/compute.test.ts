import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NeedRank } from '../need-map/rank';
import { NeedScore, type NeedIndicator, type NeedWeights } from './compute';

type Golden = {
  fips: string[];
  indicators: NeedIndicator[];
  versions: Record<string, { weights: NeedWeights; ranking: string[]; scores: Record<string, number> }>;
};
const golden = JSON.parse(readFileSync('tests/golden/need-score-ranking.json', 'utf8')) as Golden;
const order = (scored: { geo_fips: string; score: number }[]): string[] => {
  const ranks = NeedRank.rank(scored.map((s) => ({ fips: s.geo_fips, score: s.score })));
  return [...ranks.entries()].sort((a, b) => a[1] - b[1]).map(([fips]) => fips);
};
const ind = (code: string, fips: string, value: number | null, vintage = '2024'): NeedIndicator => ({ indicator_code: code, geo_fips: fips, value, vintage });

describe('golden: expected ranking', () => {
  for (const [version, g] of Object.entries(golden.versions)) {
    it(`${version} matches the hand-computed scores and ranking`, () => {
      const scored = NeedScore.compute(g.weights, golden.indicators, golden.fips);
      expect(Object.fromEntries(scored.map((s) => [s.geo_fips, s.score]))).toEqual(g.scores);
      expect(order(scored)).toEqual(g.ranking);
    });
  }

  it('new weights give a new ranking', () => {
    const [a, b] = Object.values(golden.versions);
    expect(a.ranking).not.toEqual(b.ranking);
  });

  it('v2-draft-five-input (D-026) validates, ranks differently from v1, and needs all five inputs', () => {
    const v2 = golden.versions['v2-draft-five-input'];
    expect(Object.keys(v2.weights)).toEqual(['poverty_rate', 'child_poverty_rate', 'uninsured_rate', 'single_parent_pct', 'no_vehicle_pct']);
    expect(() => NeedScore.validate(v2.weights)).not.toThrow();
    expect(Math.abs(NeedScore.sum(v2.weights) - 1)).toBeLessThan(1e-6);
    expect(v2.ranking).not.toEqual(golden.versions['v1-poverty-uninsured'].ranking);
    for (const code of Object.keys(v2.weights)) {
      const missing = golden.indicators.filter((r) => !(r.indicator_code === code && r.geo_fips === '49003'));
      expect(NeedScore.compute(v2.weights, missing, golden.fips).map((s) => s.geo_fips)).toEqual(['49001', '49005', '49007']);
    }
  });
});

describe('NeedScore.compute', () => {
  it('records each input value, z-score, weight, vintage and source row for tracing', () => {
    const d = NeedScore.compute({ poverty_rate: 0.5, uninsured_rate: 0.5 }, golden.indicators, golden.fips).find((s) => s.geo_fips === '49007');
    expect(d?.components.poverty_rate).toEqual({ value: 40, z: 1.341641, weight: 0.5, vintage: '2024', source_id: 'saipe', ingest_run_id: 'run-p' });
    expect(d?.components.uninsured_rate).toMatchObject({ value: 6, vintage: '2023', source_id: 'sahie' });
  });

  it('gives no score to a county missing any weighted input, including a not-published one', () => {
    const rows = [ind('poverty_rate', 'a', 10), ind('poverty_rate', 'b', 30), ind('poverty_rate', 'c', 20), ind('uninsured_rate', 'a', 1), ind('uninsured_rate', 'b', null)];
    const scored = NeedScore.compute({ poverty_rate: 0.5, uninsured_rate: 0.5 }, rows, ['a', 'b', 'c', 'd']);
    expect(scored.map((s) => s.geo_fips)).toEqual(['a']);
  });

  it('takes the mean and sd over counties that have a value for that input', () => {
    const rows = [ind('poverty_rate', 'a', 10), ind('poverty_rate', 'b', 30), ind('poverty_rate', 'c', 50)];
    const scored = NeedScore.compute({ poverty_rate: 1 }, rows, ['a', 'b', 'c', 'd']);
    expect(scored.map((s) => [s.geo_fips, s.score])).toEqual([['a', -1.224745], ['b', 0], ['c', 1.224745]]);
  });

  it('gives every county z 0 when an input does not vary', () => {
    const rows = [ind('poverty_rate', 'a', 5), ind('poverty_rate', 'b', 5)];
    expect(NeedScore.compute({ poverty_rate: 1 }, rows, ['a', 'b']).map((s) => s.score)).toEqual([0, 0]);
  });

  it('reads the legacy "uninsured" key from the uninsured_rate indicator and ignores other codes', () => {
    const rows = [ind('uninsured_rate', 'a', 1), ind('uninsured_rate', 'b', 3), ind('uninsured_count', 'a', 900)];
    expect(NeedScore.compute({ uninsured: 1 }, rows, ['a', 'b']).map((s) => s.score)).toEqual([-1, 1]);
  });
});

describe('NeedScore.validate', () => {
  it('accepts fractions that sum to 1', () => {
    expect(() => NeedScore.validate({ poverty_rate: 0.3, child_poverty_rate: 0.2, uninsured_rate: 0.3, single_parent_pct: 0.1, no_vehicle_pct: 0.1 })).not.toThrow();
    expect(NeedScore.sum({ a: 0.5, b: 0.5 })).toBe(1);
  });

  it('rejects empty, negative, non-numeric, duplicate and non-summing weights', () => {
    expect(() => NeedScore.validate({})).toThrow('empty');
    expect(() => NeedScore.validate({ a: 1.5, b: -0.5 })).toThrow('>= 0');
    expect(() => NeedScore.validate({ a: Number.NaN })).toThrow('>= 0');
    expect(() => NeedScore.validate({ a: '1' as unknown as number })).toThrow('>= 0');
    expect(() => NeedScore.validate({ uninsured: 0.5, uninsured_rate: 0.5 })).toThrow('twice');
    expect(() => NeedScore.validate({ a: 50, b: 50 })).toThrow('sum to 1 (sum = 100)');
    expect(() => NeedScore.compute({ a: 0.4 }, [], [])).toThrow('sum to 1');
  });
});

describe('F-210c params: z cap and reliability flag', () => {
  const v1 = golden.versions['v1-poverty-uninsured'].weights;
  const w = { poverty_rate: 0.5, uninsured_rate: 0.5 };
  const ids = Array.from({ length: 18 }, (_, i) => `c${i}`);
  // Poverty: one high outlier (c0 = 100, the rest 0); uninsured: one low outlier (c1 = -100). Each outlier's raw z is ±sqrt(17).
  const outliers = [...ids.map((f) => ind('poverty_rate', f, f === 'c0' ? 100 : 0)), ...ids.map((f) => ind('uninsured_rate', f, f === 'c1' ? -100 : 0))];
  const withMoe = (moe: number | null): NeedIndicator[] => [{ ...ind('poverty_rate', 'a', 10), moe }, { ...ind('poverty_rate', 'b', 20), moe: null }];

  it('without z_cap the v1 output is byte-for-byte the pre-F-210c output', () => {
    const before = readFileSync('tests/golden/need-score-v1-output.json', 'utf8');
    expect(`${JSON.stringify(NeedScore.compute(v1, golden.indicators, golden.fips))}\n`).toBe(before);
    expect(`${JSON.stringify(NeedScore.compute(v1, golden.indicators, golden.fips, {}))}\n`).toBe(before);
    const moe = golden.indicators.map((r) => ({ ...r, moe: 0.5 }));
    expect(`${JSON.stringify(NeedScore.compute(v1, moe, golden.fips, {}))}\n`).toBe(before);
  });

  it('clamps z to [-z_cap, +z_cap] on both sides before weighting and keeps z_raw', () => {
    const scored = NeedScore.compute(w, outliers, ids, { z_cap: 3 });
    const c0 = scored.find((s) => s.geo_fips === 'c0'), c1 = scored.find((s) => s.geo_fips === 'c1');
    expect(c0?.components.poverty_rate).toMatchObject({ z: 3, z_raw: 4.123106 });
    expect(c1?.components.uninsured_rate).toMatchObject({ z: -3, z_raw: -4.123106 });
    expect(c0?.score).toBeCloseTo(0.5 * 3 + 0.5 * (c0?.components.uninsured_rate.z ?? NaN), 6);
    // An input inside the cap is untouched; z equals z_raw.
    expect(c0?.components.uninsured_rate.z).toBe(c0?.components.uninsured_rate.z_raw);
    const uncapped = NeedScore.compute(w, outliers, ids).find((s) => s.geo_fips === 'c0');
    expect(uncapped?.components.poverty_rate.z).toBe(4.123106);
    expect(uncapped?.components.poverty_rate).not.toHaveProperty('z_raw');
  });

  it('CV = (MOE / 1.645) / value × 100; flags only above cv_flag_pct (at, just under, just over)', () => {
    const at = (moe: number) => NeedScore.compute({ poverty_rate: 1 }, withMoe(moe), ['a', 'b'], { cv_flag_pct: 30 })[0]?.components.poverty_rate;
    expect(at(4.935)).toMatchObject({ cv: 30, low_reliability: false });
    expect(at(4.9)).toMatchObject({ cv: 29.787234, low_reliability: false });
    expect(at(4.97)).toMatchObject({ cv: 30.212766, low_reliability: true });
    expect(NeedScore.cv(10, 4.97)).toBe(30.212766);
  });

  it('a missing MOE, a zero value or no cv_flag_pct sets no flag', () => {
    const b = NeedScore.compute({ poverty_rate: 1 }, withMoe(9), ['a', 'b'], { cv_flag_pct: 30 })[1]?.components.poverty_rate;
    expect(b).not.toHaveProperty('cv');
    expect(b).not.toHaveProperty('low_reliability');
    expect(NeedScore.compute({ poverty_rate: 1 }, withMoe(9), ['a', 'b'], { z_cap: 3 })[0]?.components.poverty_rate).not.toHaveProperty('low_reliability');
    expect([NeedScore.cv(0, 1), NeedScore.cv(10, null), NeedScore.cv(10, undefined)]).toEqual([null, null, null]);
  });

  it('weights that do not sum to 1 still throw, and bad params throw', () => {
    expect(() => NeedScore.compute({ poverty_rate: 0.4 }, [], [], { z_cap: 3, cv_flag_pct: 30 })).toThrow('sum to 1');
    expect(() => NeedScore.compute(w, [], [], { z_cap: 0 })).toThrow('z_cap is not a number > 0');
    expect(() => NeedScore.compute(w, [], [], { cv_flag_pct: '30' as unknown as number })).toThrow('cv_flag_pct is not a number > 0');
  });
});
