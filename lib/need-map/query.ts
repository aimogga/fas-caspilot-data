import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../synthetic/generate';
import { NeedBins } from './bins';
import { FasCounties, type FasRow } from './fas-counties';
import { NeedRank } from './rank';

export type ConfigRow = { version: string; created_at: string; approved_by: string | null };
export type ScoreRow = { version: string; geo_fips: string; score: number | string };
export type IndicatorRow = { source_id: string; indicator_code: string; geo_fips: string; value: number | string | null; moe: number | string | null; unit: string | null; vintage: string };
export type SourceRow = { id: string; name: string; last_success_at: string | null };
export type NeedInput = { configs: ConfigRow[]; scores: ScoreRow[]; indicators: IndicatorRow[]; sources: SourceRow[]; fas: FasRow[] };
export type BuildOptions = { fas?: boolean };
export type CountyRow = { fips: string; name: string; fas: boolean; rank: string; score: string; bin: string; status: string; cells: Record<string, string>; value: number | null; binNo: number | null };
export type Column = { code: string; label: string; note: string };
export type ColumnSource = { code: string; name: string; vintage: string; asOf: string };
/** `rows` honours the FAS filter; `counties` is always all 29 (the map greys non-FAS counties instead of dropping them). */
export type NeedTableData = { version: string | null; hasData: boolean; columns: Column[]; sources: ColumnSource[]; rows: CountyRow[]; counties: CountyRow[]; footer: string };

export const NOT_YET = 'Not available yet';
export const NOT_PUBLISHED = 'Not published';
const INDICATORS: Record<string, { label: string; noun?: string }> = {
  uninsured_rate: { label: 'Uninsured rate' },
  uninsured_count: { label: 'Uninsured', noun: 'people' },
  poverty_rate: { label: 'Poverty rate' },
  poverty_count: { label: 'In poverty', noun: 'people' },
  total_households: { label: 'Households', noun: 'households' },
  total_population: { label: 'Population', noun: 'people' },
  veteran_population: { label: 'Veterans', noun: 'veterans' },
  child_poverty_rate: { label: 'Child poverty rate' },
  child_poverty_count: { label: 'In child poverty', noun: 'people' },
  single_parent_pct: { label: 'Single-parent households' },
  single_parent_households: { label: 'Single-parent households (count)', noun: 'households' },
  no_vehicle_pct: { label: 'No-vehicle households' },
  no_vehicle_households: { label: 'No-vehicle households (count)', noun: 'households' },
};
const SOURCES: Record<string, string> = { 'census-sahie': 'Census SAHIE', 'census-saipe': 'Census SAIPE', 'census-acs': 'Census ACS 5-year' };

export class NeedMapQuery {
  static label(code: string): string {
    const words = code.replace(/_/g, ' ');
    return INDICATORS[code]?.label ?? words.charAt(0).toUpperCase() + words.slice(1);
  }

  /** `+x.xx` / `−x.xx` (U+2212, DESIGN general rule 6). */
  static signed(n: number): string {
    return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
  }

  /** Row label: `<Name> County, rank n of N, need score ±x.xx` or `<Name> County, not published`; `, FAS county` appended for service counties. */
  static rowLabel(row: CountyRow): string {
    const base = row.status === 'Ranked' ? `${row.name}, rank ${row.rank}, need score ${row.score}` : `${row.name}, ${row.status.toLowerCase()}`;
    return row.fas ? `${base}, FAS county` : base;
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
    const noun = INDICATORS[row.indicator_code]?.noun;
    const value = row.unit === 'percent' ? `${n}%` : row.unit === 'count' && noun ? `${plain} ${noun}` : plain;
    return row.moe === null ? value : `${value} ± ${Number(row.moe).toLocaleString('en-US')}`;
  }

  static monthYear(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  /** Source name, vintage and as-of month for one indicator column (panel rows; the column note is `<name> <vintage>`). */
  static columnSource(row: IndicatorRow, sources: SourceRow[]): ColumnSource {
    const src = sources.find((s) => s.id === row.source_id);
    const name = src ? SOURCES[src.name] ?? src.name : 'Unknown source';
    const asOf = src?.last_success_at ? NeedMapQuery.monthYear(src.last_success_at) : NOT_YET;
    return { code: row.indicator_code, name, vintage: row.vintage, asOf };
  }

  /** `latest` is the newest `last_success_at` among the sources in use (ISO). */
  static footer(version: string | null, sources: ColumnSource[], latest: string | null): string {
    const names = [...new Set(sources.map((s) => s.name))].join(', ') || NOT_YET;
    return `Public sources: ${names} · Need score version ${version ?? NOT_YET} · as of ${latest ? NeedMapQuery.monthYear(latest) : NOT_YET} · Placeholder bins`;
  }

  /** All 29 counties; `opts.fas` keeps FAS service counties only, each with its statewide rank. */
  static build(input: NeedInput, opts: BuildOptions = {}): NeedTableData {
    const version = NeedMapQuery.approved(input.configs)?.version ?? null;
    const fas = FasCounties.fromRows(input.fas);
    const indicators = NeedMapQuery.latest(input.indicators);
    const codes = [...new Set(indicators.map((i) => i.indicator_code))].sort();
    const sources = codes.map((code) => NeedMapQuery.columnSource(indicators.find((i) => i.indicator_code === code) as IndicatorRow, input.sources));
    const columns = sources.map((s) => ({ code: s.code, label: NeedMapQuery.label(s.code), note: `${s.name} ${s.vintage}` }));
    const latest = input.sources.filter((s) => indicators.some((i) => i.source_id === s.id)).map((s) => s.last_success_at ?? '').sort().at(-1) || null;
    const scored = COUNTIES.map((c) => {
      const hit = input.scores.find((s) => s.version === version && s.geo_fips === c.fips);
      return { fips: c.fips, score: hit ? Number(hit.score) : null };
    });
    const ranks = NeedRank.rank(scored);
    const bins = NeedBins.assign(scored);
    const binMax = Math.max(0, ...bins.values());
    const counties = COUNTIES.map((c, i) => {
      const score = scored[i]?.score ?? null;
      const missing = version === null ? NOT_YET : NOT_PUBLISHED;
      const cells = Object.fromEntries(codes.map((code) => [code, NeedMapQuery.cell(indicators.find((r) => r.indicator_code === code && r.geo_fips === c.fips))]));
      return { fips: c.fips, name: `${c.name} County`, fas: fas.has(c.fips), cells, status: score === null ? missing : 'Ranked',
        rank: ranks.has(c.fips) ? `${ranks.get(c.fips)} of ${ranks.size}` : missing,
        score: score === null ? missing : NeedMapQuery.signed(score),
        bin: bins.has(c.fips) ? `${bins.get(c.fips)} of ${binMax}` : missing,
        value: score, binNo: bins.get(c.fips) ?? null };
    });
    counties.sort((a, b) => (ranks.get(a.fips) ?? Infinity) - (ranks.get(b.fips) ?? Infinity) || a.name.localeCompare(b.name));
    const rows = counties.filter((r) => !opts.fas || r.fas);
    const hasData = indicators.length > 0 || ranks.size > 0;
    return { version, hasData, columns, sources, rows, counties, footer: NeedMapQuery.footer(version, sources, latest) };
  }

  static async load(client: SupabaseClient, opts: BuildOptions = {}): Promise<NeedTableData> {
    const [configs, scores, indicators, sources, fas] = await Promise.all([
      client.from('need_score_config').select('version,created_at,approved_by'),
      client.from('need_score').select('version,geo_fips,score'),
      client.from('public_indicator').select('source_id,indicator_code,geo_fips,value,moe,unit,vintage'),
      client.from('source_registry').select('id,name,last_success_at'),
      client.from('fas_service_county').select('fips'),
    ]);
    for (const r of [configs, scores, indicators, sources, fas]) {
      if (r.error) throw new Error(r.error.message);
    }
    return NeedMapQuery.build({
      configs: configs.data ?? [],
      scores: scores.data ?? [],
      indicators: indicators.data ?? [],
      sources: sources.data ?? [],
      fas: fas.data ?? [],
    }, opts);
  }
}
