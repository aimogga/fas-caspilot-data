import { NeedMapQuery } from '../need-map/query';

export type NeedWeights = Record<string, number>;
/** need_score_config.params (F-210c). `{}` keeps the v1 maths. */
export type NeedParams = { z_cap?: number; cv_flag_pct?: number };
export type NeedIndicator = {
  indicator_code: string;
  geo_fips: string;
  value: number | string | null;
  moe?: number | string | null;
  vintage: string;
  source_id?: string;
  ingest_run_id?: string | null;
};
/** `z_raw` only when `z_cap` is set; `cv`/`low_reliability` only when `cv_flag_pct` is set and the row has a MOE. */
export type NeedComponent = {
  value: number; z: number; weight: number; vintage: string; source_id: string | null; ingest_run_id: string | null;
  z_raw?: number; cv?: number; low_reliability?: boolean;
};
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

  /** Census MOEs are 90% intervals: CV = (MOE / 1.645) / value × 100. Null without a MOE or with a value <= 0. */
  static cv(value: number, moe: number | string | null | undefined): number | null {
    if (moe === null || moe === undefined || moe === '' || !Number.isFinite(Number(moe)) || value <= 0) return null;
    return round6((Number(moe) / 1.645 / value) * 100);
  }

  static validateParams(params: NeedParams): void {
    for (const k of ['z_cap', 'cv_flag_pct'] as const) {
      const v = params[k];
      if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v <= 0)) throw new Error(`need score param ${k} is not a number > 0`);
    }
  }

  /**
   * score_c = sum_i w_i * z_ic, z_ic = (x_ic - mean_i) / sd_i over counties with a published value for input i
   * (population sd; sd 0 gives z 0). Uses each input's newest vintage. A county missing any weighted input gets no score.
   * `params.z_cap` clamps each z to [-z_cap, +z_cap] before weighting; `params.cv_flag_pct` flags components whose CV is above it.
   */
  static compute(weights: NeedWeights, indicators: NeedIndicator[], fips: string[], params: NeedParams = {}): NeedScored[] {
    NeedScore.validate(weights);
    NeedScore.validateParams(params);
    const cap = params.z_cap, flag = params.cv_flag_pct;
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
        const raw = i.sd === 0 ? 0 : (x - i.mean) / i.sd;
        const z = cap === undefined ? raw : Math.min(cap, Math.max(-cap, raw));
        score += i.weight * z;
        const c: NeedComponent = { value: x, z: round6(z), weight: i.weight, vintage: row.vintage, source_id: row.source_id ?? null, ingest_run_id: row.ingest_run_id ?? null };
        if (cap !== undefined) c.z_raw = round6(raw);
        const cv = flag === undefined ? null : NeedScore.cv(x, row.moe);
        if (flag !== undefined && cv !== null) Object.assign(c, { cv, low_reliability: cv > flag });
        components[i.code] = c;
      }
      out.push({ geo_fips, score: round6(score), components });
    }
    return out;
  }
}
