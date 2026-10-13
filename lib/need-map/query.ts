import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../synthetic/generate';
import { NeedBins } from './bins';
import { NeedRank } from './rank';

export type ConfigRow = { version: string; created_at: string; approved_by: string | null };
export type ScoreRow = { version: string; geo_fips: string; score: number | string };
export type IndicatorRow = {
  source_id: string;
  indicator_code: string;
  geo_fips: string;
  value: number | string | null;
  moe: number | string | null;
  unit: string | null;
  vintage: string;
};
export type SourceRow = { id: string; name: string; last_success_at: string | null };
export type NeedInput = { configs: ConfigRow[]; scores: ScoreRow[]; indicators: IndicatorRow[]; sources: SourceRow[] };
export type CountyRow = { fips: string; name: string; rank: string; score: string; bin: string; status: string; cells: Record<string, string> };
export type NeedTableData = { version: string | null; hasData: boolean; codes: string[]; rows: CountyRow[]; footer: string };

export const NOT_YET = 'Not available yet';
export const NOT_PUBLISHED = 'Not published';
const LABELS: Record<string, string> = {
  uninsured_rate: 'Uninsured rate',
  uninsured_count: 'Uninsured people',
  poverty_rate: 'Poverty rate',
  poverty_count: 'People in poverty',
};

export class NeedMapQuery {
  static label(code: string): string {
    return LABELS[code] ?? code;
  }

  static eyebrow(role: unknown): string {
    return role === 'board_viewer' ? 'BOARD' : 'WORKSPACE';
  }

  /** Newest approved version only; unapproved versions never show. */
  static approved(configs: ConfigRow[]): ConfigRow | null {
    const ok = configs.filter((c) => c.approved_by !== null);
    ok.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return ok[0] ?? null;
  }

  /** Keep each indicator's newest vintage only. */
  static latest(rows: IndicatorRow[]): IndicatorRow[] {
    const newest = new Map<string, string>();
    for (const r of rows) {
      if (r.vintage > (newest.get(r.indicator_code) ?? '')) newest.set(r.indicator_code, r.vintage);
    }
    return rows.filter((r) => newest.get(r.indicator_code) === r.vintage);
  }

  static cell(row: IndicatorRow | undefined): string {
    if (!row) return NOT_YET;
    if (row.value === null || row.unit === 'not_published') return NOT_PUBLISHED;
    const n = Number(row.value);
    const plain = n.toLocaleString('en-US');
    const value = row.unit === 'percent' ? `${n}%` : row.unit === 'count' ? `${plain} people` : plain;
    return row.moe === null ? value : `${value} ± ${Number(row.moe).toLocaleString('en-US')}`;
  }

  static monthYear(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  static footer(version: string | null, indicators: IndicatorRow[], sources: SourceRow[]): string {
    const used = sources.filter((s) => indicators.some((i) => i.source_id === s.id));
    const names = used.map((s) => s.name).join(', ') || NOT_YET;
    const dates = used.flatMap((s) => (s.last_success_at ? [s.last_success_at] : [])).sort();
    const asOf = dates.length ? NeedMapQuery.monthYear(dates[dates.length - 1] as string) : NOT_YET;
    return `Public sources: ${names} · Need score version ${version ?? NOT_YET} · as of ${asOf}`;
  }

  static build(input: NeedInput): NeedTableData {
    const version = NeedMapQuery.approved(input.configs)?.version ?? null;
    const indicators = NeedMapQuery.latest(input.indicators);
    const codes = [...new Set(indicators.map((i) => i.indicator_code))].sort();
    const scored = COUNTIES.map((c) => {
      const hit = input.scores.find((s) => s.version === version && s.geo_fips === c.fips);
      return { fips: c.fips, score: hit ? Number(hit.score) : null };
    });
    const ranks = NeedRank.rank(scored);
    const bins = NeedBins.assign(scored);
    const binMax = Math.max(0, ...bins.values());
    const rows = COUNTIES.map((c, i) => {
      const score = scored[i]?.score ?? null;
      const missing = version === null ? NOT_YET : NOT_PUBLISHED;
      const cells = Object.fromEntries(codes.map((code) => [code, NeedMapQuery.cell(indicators.find((r) => r.indicator_code === code && r.geo_fips === c.fips))]));
      return {
        fips: c.fips,
        name: `${c.name} County`,
        rank: ranks.has(c.fips) ? `${ranks.get(c.fips)} of ${ranks.size}` : missing,
        score: score === null ? missing : `${score >= 0 ? '+' : ''}${score.toFixed(2)}`,
        bin: bins.has(c.fips) ? `${bins.get(c.fips)} of ${binMax}` : missing,
        status: score === null ? missing : 'Ranked',
        cells,
      };
    });
    rows.sort((a, b) => (ranks.get(a.fips) ?? Infinity) - (ranks.get(b.fips) ?? Infinity) || a.name.localeCompare(b.name));
    const hasData = indicators.length > 0 || ranks.size > 0;
    return { version, hasData, codes, rows, footer: NeedMapQuery.footer(version, indicators, input.sources) };
  }

  static async load(client: SupabaseClient): Promise<NeedTableData> {
    const [configs, scores, indicators, sources] = await Promise.all([
      client.from('need_score_config').select('version,created_at,approved_by'),
      client.from('need_score').select('version,geo_fips,score'),
      client.from('public_indicator').select('source_id,indicator_code,geo_fips,value,moe,unit,vintage'),
      client.from('source_registry').select('id,name,last_success_at'),
    ]);
    for (const r of [configs, scores, indicators, sources]) {
      if (r.error) throw new Error(r.error.message);
    }
    return NeedMapQuery.build({
      configs: configs.data ?? [],
      scores: scores.data ?? [],
      indicators: indicators.data ?? [],
      sources: sources.data ?? [],
    });
  }
}
