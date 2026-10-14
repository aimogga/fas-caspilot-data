import { NeedMapQuery } from '../need-map/query';

export type NeedWeights = Record<string, number>;
export type NeedIndicator = {
  indicator_code: string;
  geo_fips: string;
  value: number | string | null;
  vintage: string;
  source_id?: string;
  ingest_run_id?: string | null;
};
export type NeedComponent = { value: number; z: number; weight: number; vintage: string; source_id: string | null; ingest_run_id: string | null };
export type NeedScored = { geo_fips: string; score: number; components: Record<string, NeedComponent> };

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

export class NeedScore {
  /** Short weight keys that name a stored indicator code (the seeded v2-synthetic config uses "uninsured"). */
  static readonly ALIAS: Record<string, string> = { uninsured: 'uninsured_rate' };

  static code(key: string): string {
    return NeedScore.ALIAS[key] ?? key;
  }

  static sum(weights: NeedWeights): number {
    return Object.values(weights).reduce((a, w) => a + w, 0);
  }

  /** D-026: weights are fractions of 1. Throws instead of silently normalizing. */
  static validate(weights: NeedWeights): void {
    const keys = Object.keys(weights);
    if (keys.length === 0) throw new Error('need score weights are empty');
    for (const k of keys) {
      if (typeof weights[k] !== 'number' || !Number.isFinite(weights[k]) || weights[k] < 0) throw new Error(`need score weight for ${k} is not a number >= 0`);
    }
    if (new Set(keys.map(NeedScore.code)).size !== keys.length) throw new Error('need score weights name the same input twice');
    const sum = NeedScore.sum(weights);
    if (Math.abs(sum - 1) > 1e-6) throw new Error(`need score weights must sum to 1 (sum = ${sum})`);
  }

  /**
   * score_c = sum_i w_i * z_ic, z_ic = (x_ic - mean_i) / sd_i over counties with a published value for input i
   * (population sd; sd 0 gives z 0). Uses each input's newest vintage. A county missing any weighted input gets no score.
   */
  static compute(weights: NeedWeights, indicators: NeedIndicator[], fips: string[]): NeedScored[] {
    NeedScore.validate(weights);
    const latest = NeedMapQuery.latest(indicators);
    const wanted = new Set(fips);
    const inputs = Object.entries(weights).map(([key, weight]) => {
      const code = NeedScore.code(key);
      const byFips = new Map<string, { x: number; row: NeedIndicator }>();
      for (const row of latest) {
        if (row.indicator_code === code && row.value !== null && wanted.has(row.geo_fips) && Number.isFinite(Number(row.value))) byFips.set(row.geo_fips, { x: Number(row.value), row });
      }
      const xs = [...byFips.values()].map((v) => v.x);
      const mean = xs.reduce((a, x) => a + x, 0) / (xs.length || 1);
      const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length || 1));
      return { code, weight, byFips, mean, sd };
    });
    const out: NeedScored[] = [];
    for (const geo_fips of fips) {
      if (inputs.some((i) => !i.byFips.has(geo_fips))) continue;
      const components: Record<string, NeedComponent> = {};
      let score = 0;
      for (const i of inputs) {
        const { x, row } = i.byFips.get(geo_fips) as { x: number; row: NeedIndicator };
        const z = i.sd === 0 ? 0 : (x - i.mean) / i.sd;
        score += i.weight * z;
        components[i.code] = { value: x, z: round6(z), weight: i.weight, vintage: row.vintage, source_id: row.source_id ?? null, ingest_run_id: row.ingest_run_id ?? null };
      }
      out.push({ geo_fips, score: round6(score), components });
    }
    return out;
  }
}
