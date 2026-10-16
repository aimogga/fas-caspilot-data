import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../synthetic/generate';
import { NeedMapQuery, NOT_PUBLISHED, NOT_YET, type IndicatorRow, type ScoreRow, type SourceRow } from '../need-map/query';
import { syntheticBadgeVisible } from '../shell/nav';
import { indicatorCodes, inputLabel, sourceLabel } from './labels';

export type ConfigRow = { version: string; weights: Record<string, number>; created_at: string; approved_by: string | null };
export type MethodInput = { configs: ConfigRow[]; scores: ScoreRow[]; indicators: IndicatorRow[]; sources: SourceRow[] };
export type InputRow = { key: string; label: string; known: boolean; source: string; vintage: string; asOf: string; status: 'current' | 'not_published' };
/** `points` is the weight as a whole number out of 100 (DESIGN.md need score rule 1); null when the stored weights sum to zero. */
export type WeightRow = { key: string; label: string; known: boolean; weight: string; share: string; points: number | null };
export type Draft = { version: string; createdLabel: string };
export type MethodologyView = {
  version: string; approvedLabel: string; synthetic: boolean; singleInput: boolean; draft: Draft | null;
  inputs: InputRow[]; weights: WeightRow[]; sum: string; mismatch: string | null; notPublished: string | null; footer: string; scored: number; counties: number;
};

export class MethodologyQuery {
  static draftFor(view: MethodologyView, role: unknown): Draft | null {
    return role === 'admin' || role === 'staff' ? view.draft : null;
  }

  static draft(configs: ConfigRow[], approved: ConfigRow): Draft | null {
    const newer = configs.filter((c) => c.approved_by === null && c.created_at > approved.created_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return newer[0] ? { version: newer[0].version, createdLabel: NeedMapQuery.monthYear(newer[0].created_at) } : null;
  }

  static input(key: string, indicators: IndicatorRow[], sources: SourceRow[]): InputRow {
    const { label, known } = inputLabel(key);
    const row = indicators.find((i) => indicatorCodes(key).includes(i.indicator_code));
    const src = row ? sources.find((s) => s.id === row.source_id) : undefined;
    if (!row || !src?.last_success_at) return { key, label, known, source: src ? sourceLabel(src.name) : '—', vintage: '—', asOf: '—', status: 'not_published' };
    return { key, label, known, source: sourceLabel(src.name), vintage: row.vintage, asOf: NeedMapQuery.monthYear(src.last_success_at), status: 'current' };
  }

  static build(input: MethodInput, env?: string): MethodologyView | null {
    const approved = NeedMapQuery.approved(input.configs) as ConfigRow | null;
    if (!approved) return null;
    const indicators = NeedMapQuery.latest(input.indicators);
    const keys = Object.keys(approved.weights ?? {});
    const total = keys.reduce((acc, k) => acc + Number(approved.weights[k]), 0);
    const sum = Number(total.toFixed(4));
    const inputs = keys.map((k) => MethodologyQuery.input(k, indicators, input.sources));
    const share = (w: number) => (total > 0 ? `${Math.round((w / total) * 1000) / 10}%` : NOT_PUBLISHED);
    const points = (w: number) => (total > 0 ? Math.round((w / total) * 100) : null);
    const weights = inputs.map((r) => ({ key: r.key, label: r.label, known: r.known, weight: String(Number(approved.weights[r.key])), share: share(Number(approved.weights[r.key])), points: points(Number(approved.weights[r.key])) }));
    const scored = new Set(input.scores.filter((s) => s.version === approved.version).map((s) => s.geo_fips)).size, missing = COUNTIES.length - scored;
    const names = [...new Set(inputs.map((r) => r.source).filter((s) => s !== '—'))];
    const loads = input.sources.map((s) => s.last_success_at ?? '').filter(Boolean).sort();
    const synthetic = approved.version.includes('synthetic') || syntheticBadgeVisible(env);
    const asOf = loads.length ? `as of ${NeedMapQuery.monthYear(loads[loads.length - 1] as string)}` : 'date not available yet';
    const footer = `Public sources: ${names.join(', ') || NOT_YET} · Need score version ${approved.version} · ${asOf}${synthetic ? ' · Synthetic data' : ''}`;
    const mismatch = Math.abs(sum - 1) < 0.001 || Math.abs(sum - 100) < 0.001 ? null : `Weights in this version do not sum to 1 (sum = ${sum}).`;
    const notPublished = missing > 0 ? `${missing} of ${COUNTIES.length} counties are Not published for this version.` : null;
    const singleInput = keys.length === 1 && approved.version.includes('synthetic');
    const draft = MethodologyQuery.draft(input.configs, approved);
    return { version: approved.version, approvedLabel: NeedMapQuery.monthYear(approved.created_at), synthetic, singleInput, draft, inputs, weights, sum: String(sum), mismatch, notPublished, footer, scored, counties: COUNTIES.length };
  }

  static async load(client: SupabaseClient, env?: string): Promise<MethodologyView | null> {
    const [configs, scores, indicators, sources] = await Promise.all([
      client.from('need_score_config').select('version,weights,created_at,approved_by'),
      client.from('need_score').select('version,geo_fips,score'),
      client.from('public_indicator').select('source_id,indicator_code,geo_fips,value,moe,unit,vintage'),
      client.from('source_registry').select('id,name,last_success_at'),
    ]);
    const bad = [configs, scores, indicators, sources].find((r) => r.error);
    if (bad?.error) throw new Error(bad.error.message);
    return MethodologyQuery.build({ configs: configs.data ?? [], scores: scores.data ?? [], indicators: indicators.data ?? [], sources: sources.data ?? [] }, env);
  }
}
