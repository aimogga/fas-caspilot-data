// F-504: fit score v0 (docs/GRANT_MATCHING.md). Pure. Weights are fractions of 1 from `match_config` (D-025), shown as points of 100.
// Every component stores a plain-English `reason` built only from the inputs and the `source_refs` it read; the panel renders those, never recomputes.
import { opportunityText, toMatchFlags } from './eligibility';
import type { EligibilityResult, Flag, OpportunityInput, OrgProfile } from './types';

// F-504b params (all optional; v0-draft sets none, so its maths is unchanged): `floor_components` names components whose genuine 0 caps the total at 0
// ("could not score" never caps); `award_too_small_value` scores an award below the worth-applying minimum; `min_days_to_close` zeroes effort under it;
// `max_cost_share_pct` zeroes award fit when the required match exceeds it. F-504d: `band_strong` / `band_look` only name the score bands (`./band`).
export type MatchParams = { prep_days?: number; themes_for_full_credit?: number; evidence_available?: string[];
  floor_components?: string[]; award_too_small_value?: number; min_days_to_close?: number; max_cost_share_pct?: number; band_strong?: number; band_look?: number;
  /** F-504e: evidence kinds FAS's own records hold (`lib/grants/evidence.ts`); set at recompute, never stored in `match_config`. */ evidence_loaded?: string[] };
export type MatchConfig = { id: string; weights: Record<string, number>; params: MatchParams; created_at: string; approved_by: string | null };
export type Component = { key: string; label: string; weight: number; value: number; points: number; max: number; reason: string; source_refs: string[] };
export type MatchScore = { score: number; configId: string; components: Component[] };
type Part = { value: number; reason: string; source_refs: string[]; unknown?: true }; type Ctx = { o: OpportunityInput; org: OrgProfile; e: EligibilityResult; p: MatchParams; now: Date };

const EVIDENCE: Record<string, RegExp> = { outcomes: /\boutcomes?\b/i, cost: /\bcost(?:s|-effective\w*)?\b/i, timeliness: /\b(?:timeliness|timely|wait(?:ing)? times?|days to)\b/i };
/** The evidence kinds a listing's text asks for, in a fixed order (also read by the grant packet's "What this grant asks for" note, F-403c). */
export const askedEvidence = (text: string): string[] => Object.keys(EVIDENCE).filter((k) => EVIDENCE[k].test(text));
const REGIONAL = /\b(?:regional|region|neighboring states|mountain west|intermountain|western states)\b/i;
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const cannot = (what: string, field: string): Part => ({ value: 0, reason: `Could not score ${what}: ${field} missing`, source_refs: [field], unknown: true });
const fromFlag = (f: Flag, value: number): Part => ({ value, reason: f.message, source_refs: [f.source_ref] });

/** One scorer per v0 component (mission 30, eligibility certainty 20, evidence 15, award size 15, geography 10, effort vs time 10); `value` is 0–1. */
export const SCORERS: Record<string, (c: Ctx) => Part> = {
  mission_fit({ o, org, p }) {
    if (org.program_themes === 'unknown') return cannot('mission fit', 'org.program_themes');
    const cats = (o.eligibility.funding_categories ?? o.raw?.summary?.funding_categories ?? []).join(' ').replace(/_/g, ' ');
    const fields: [string, string, string][] = [['description', 'opportunity.description', o.description ?? ''],
      ['eligibility description', 'opportunity.eligibility.applicant_eligibility_description', o.eligibility.applicant_eligibility_description ?? ''], ['funding categories', 'opportunity.eligibility.funding_categories', cats]];
    if (!fields.some(([, , text]) => text)) return cannot('mission fit', 'opportunity.description');
    const hits = org.program_themes.flatMap((t) => { const f = fields.find(([, , text]) => text.toLowerCase().includes(t.toLowerCase())); return f ? [{ t, where: f[0], ref: f[1] }] : []; });
    const n = org.program_themes.length;
    if (!hits.length) return { value: 0, reason: `None of the ${n} configured themes appear in the opportunity text`, source_refs: ['org.program_themes', ...fields.map((f) => f[1])] };
    return { value: Math.min(1, hits.length / (p.themes_for_full_credit ?? 3)), reason: `Matched ${hits.length} of ${n} configured themes: ${hits.map((h) => `${h.t} (${h.where})`).join(', ')}`, source_refs: ['org.program_themes', ...new Set(hits.map((h) => h.ref))] };
  },
  eligibility_certainty({ e }) {
    const all = Object.values(e.checks);
    const n = (s: string) => all.filter((x) => x === s).length;
    return { value: all.length ? n('pass') / all.length : 0, reason: `${n('pass')} of ${all.length} eligibility checks passed, ${n('flagged')} flagged, ${n('unclear')} could not be checked`, source_refs: ['eligibility.checks', ...new Set(e.flags.map((f) => f.source_ref))] };
  },
  evidence_readiness({ o, p }) {
    const text = opportunityText(o);
    if (!text) return cannot('evidence readiness', 'opportunity.description');
    const refs = ['opportunity.description', 'match_config.params.evidence_available'];
    const asked = askedEvidence(text);
    if (!asked.length) return { value: 1, reason: 'The opportunity text names no outcome, cost or timeliness evidence', source_refs: refs };
    const loaded = p.evidence_loaded ?? [], have = asked.filter((k) => (p.evidence_available ?? []).includes(k) || loaded.includes(k));
    const fromRecords = have.filter((k) => loaded.includes(k)).map((k) => `fas_records.${k}`);
    return { value: have.length / asked.length, reason: `Asks for ${asked.join(', ')} evidence; FAS has ${have.length ? have.join(', ') : 'none of it'} loaded (${have.length} of ${asked.length})`, source_refs: [...refs, ...fromRecords] };
  },
  award_size_fit({ o, org, e, p }) {
    const f = e.flags.find((x) => x.code === 'award_size');
    if (f && e.checks.award_size === 'unclear') return { ...fromFlag(f, 0.5), unknown: true };
    if (f) return fromFlag(f, f.severity === 'info' ? (p.award_too_small_value ?? 0.5) : 0);
    const share = e.flags.find((x) => x.code === 'cost_share' && x.severity === 'warning'); const pct = Number(/(\d{1,3})\s?%/.exec(opportunityText(o))?.[1]);
    if (share && p.max_cost_share_pct != null && pct > p.max_cost_share_pct) return { value: 0, reason: `${share.message}, above the ${p.max_cost_share_pct}% the matching rules allow`, source_refs: [share.source_ref, 'match_config.params.max_cost_share_pct'] };
    const range = [o.award_floor, o.award_ceiling].filter((n): n is number => n != null).map(usd).join('–');
    return { value: 1, reason: `Award range ${range} fits a ${usd(org.annual_budget_usd as number)} annual budget`, source_refs: ['opportunity.award_floor', 'opportunity.award_ceiling', 'org.annual_budget_usd'] };
  },
  geography({ o, e }) {
    const f = e.flags.find((x) => x.code === 'geography');
    if (f) return fromFlag(f, 0);
    const text = opportunityText(o);
    const tier: Part = { value: 0.5, reason: 'National program; Utah applicants are not named', source_refs: ['opportunity.description'] };
    return /\butah\b/i.test(text) ? { ...tier, value: 1, reason: 'Names Utah in the opportunity text' } : REGIONAL.test(text) ? { ...tier, value: 0.75, reason: 'Regional program; names a region but not Utah' } : tier;
  },
  effort_vs_time({ o, now, p }) {
    const prep = p.prep_days ?? 30; const days = o.close_date ? Math.ceil((Date.parse(o.close_date) - now.getTime()) / 86_400_000) : NaN;
    if (Number.isNaN(days)) return cannot('effort vs time', 'opportunity.close_date');
    const out: Part = { value: Math.min(1, days / prep), reason: `${days} days to the ${o.close_date} close date, against ${prep} days of typical prep`, source_refs: ['opportunity.close_date', 'match_config.params.prep_days'] };
    if (days < 0) return { ...out, value: 0, reason: `Closed on ${o.close_date}` };
    const min = p.min_days_to_close;
    if (min != null && days < min) return { value: 0, reason: `Only ${days} days to the ${o.close_date} close date, under the ${min}-day minimum`, source_refs: [...out.source_refs, 'match_config.params.min_days_to_close'] };
    return out;
  },
};

/** D-025: weights are fractions of 1 and must name known components. Throws instead of silently normalizing. */
export function validateWeights(weights: Record<string, number>): void {
  const keys = Object.keys(weights);
  if (!keys.length) throw new Error('match weights are empty');
  for (const k of keys) if (!(k in SCORERS)) throw new Error(`unknown match component ${k}`);
  for (const k of keys) if (typeof weights[k] !== 'number' || !Number.isFinite(weights[k]) || weights[k] < 0) throw new Error(`match weight for ${k} is not a number >= 0`);
  const sum = keys.reduce((a, k) => a + weights[k], 0);
  if (Math.abs(sum - 1) > 1e-6) throw new Error(`match weights must sum to 1 (sum = ${sum})`);
}

/** points = round(weight × value × 100); score = Σ points clamped to 0–100; any blocker, or a genuine 0 on a `floor_components` component, caps the score at 0 with its own reason component. */
export function scoreOpportunity(o: OpportunityInput, org: OrgProfile, e: EligibilityResult, config: MatchConfig, now: Date): MatchScore {
  validateWeights(config.weights);
  const ctx: Ctx = { o, org, e, p: config.params ?? {}, now };
  const floored: Component[] = [];
  const components: Component[] = Object.entries(config.weights).map(([key, weight]) => {
    const { value: raw, reason, source_refs, unknown } = SCORERS[key](ctx);
    const value = Math.round(raw * 1e4) / 1e4;
    const c = { key, label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), weight, value, points: Math.round(weight * value * 100), max: Math.round(weight * 100), reason, source_refs };
    if (value === 0 && !unknown && (ctx.p.floor_components ?? []).includes(key)) floored.push(c);
    return c;
  });
  const blockers = e.flags.filter((f) => f.severity === 'blocker');
  if (blockers.length) components.push({ key: 'blocker_cap', label: 'Blocker', weight: 0, value: 0, points: 0, max: 0, reason: `Score capped at 0: ${blockers.map((b) => b.message).join('; ')}`, source_refs: [...new Set(blockers.map((b) => b.source_ref))] });
  else if (floored.length) components.push({ key: 'floor_cap', label: 'Floor', weight: 0, value: 0, points: 0, max: 0, reason: `Score capped at 0 (${floored.map((c) => c.label.toLowerCase()).join(', ')} scored 0): ${floored.map((c) => c.reason).join('; ')}`,
    source_refs: [...new Set([...floored.flatMap((c) => c.source_refs), 'match_config.params.floor_components'])] });
  const score = blockers.length || floored.length ? 0 : Math.min(100, Math.max(0, components.reduce((a, c) => a + c.points, 0)));
  return { score, configId: config.id, components };
}

/** Shape of one `match_result` upsert (unique on org_id, opportunity_id, config_id). */
export function toMatchResultRow(orgId: string, opportunityId: string, match: MatchScore, e: EligibilityResult, now: Date) {
  return { org_id: orgId, opportunity_id: opportunityId, config_id: match.configId, model_version: match.configId, score: match.score, components: match.components, flags: toMatchFlags(e), computed_at: now.toISOString() };
}
