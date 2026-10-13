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
