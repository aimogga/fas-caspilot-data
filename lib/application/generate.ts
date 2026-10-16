import type { SupabaseClient } from '@supabase/supabase-js';
import { z, ZodError } from 'zod';
import { generateJson, LlmError, type LlmMeta } from '../llm';
import { claimChecker, copyHits } from '../strategy/citations';
import { StrategyDraftSchema, type StrategyDraft } from '../strategy/schema';
import { assertPrivate, type Snapshot } from '../strategy/snapshot';
import { batchPlan, limitProblems, planSections, type SectionPlan } from './sections';

const SectionOutSchema = z.object({ key: z.string(), heading: z.string(), criterion: z.string(), body: z.string(), citation_ids: z.array(z.string()), assumptions: z.array(z.string()) });
export const SectionsSchema = z.object({ sections: z.array(SectionOutSchema) });
type SectionOut = z.infer<typeof SectionOutSchema>;
export type Section = SectionOut & Pick<SectionPlan, 'points' | 'limit'> & { status: 'ok' | 'needs_edit'; reasons: string[] };
export type ApplicationResult =
  | { status: 'DRAFT'; sections: Section[]; validation_report: { ok: boolean; needs_edit: string[]; rounds: Record<string, number> }; model_meta: { calls: number; retried: boolean; calls_detail: LlmMeta[] } }
  | { status: 'quota'; message: string };

export const QUOTA_MESSAGE = 'AI limit reached for today, try again tomorrow';
export const NOT_APPROVED = 'Only an approved strategy can be used to write an application. Approve the strategy draft first.';
export class ApplicationError extends Error { readonly name = 'ApplicationError'; }
export const SYSTEM = [
  'You write grant application narrative sections for Family Advocacy Services (FAS), a Utah nonprofit that pays for therapy for families. Answer with JSON matching the schema.',
  "Write one section per item in SECTIONS, under its heading, in FAS's voice (we, our families). Keep each body within its limit.",
  'Use only the facts in SNAPSHOT and the approved STRATEGY. Every number in a body must be a value of a fact listed in that section\'s citation_ids. Never invent statistics.',
  'Where an org_knowledge fact holds approved FAS boilerplate, reuse its wording. Never copy text from other organizations.',
  'Put anything SNAPSHOT does not state (a plan detail, a partner, a date) in assumptions instead of the body.',
].join('\n');

/** The model sees the facts, the approved strategy for these criteria and the plan only; abstracts stay out of the prompt and feed the copy guard. */
export function buildPrompt(s: Snapshot, strategy: StrategyDraft, plan: SectionPlan[], failures: string[] = []): string {
  const crit = new Set(plan.map((p) => p.criterion)), retry = failures.length ? `\n\nThese sections were rejected. Rewrite them and fix:\n- ${failures.join('\n- ')}` : '';
  const sections = plan.map(({ key, heading, criterion, points, limit }) => ({ key, heading, criterion, points, limit }));
  return `SNAPSHOT\n${JSON.stringify({ opportunity_id: s.opportunity_id, facts: s.facts })}\n\nSTRATEGY\n${JSON.stringify(strategy.criteria_map.filter((c) => crit.has(c.criterion)))}\n\nSECTIONS\n${JSON.stringify(sections)}${retry}`;
}

/** OpenRouter out of quota (the #227 guard's reason, or its 429/402) while Gemini also failed. */
export function quotaExhausted(e: unknown): boolean {
  return e instanceof LlmError && e.attempts.some((a) => a.provider === 'gemini') &&
    e.attempts.some((a) => a.provider === 'openrouter' && ['openrouter_quota_exhausted', '429', '402'].includes(String(a.status)));
}

/** Pure per-section checks: cited ids resolve (same registry as strategy drafts), numbers match, length within limit, no 12-word copy. */
export function checkSection(p: SectionPlan, out: SectionOut | undefined, s: Snapshot): string[] {
  if (!out) return ['section was not returned'];
  const claim = claimChecker(s)(p.key, out.body, out.citation_ids);
  return [...claim.problems, ...limitProblems(p, out.body), ...copyHits([{ path: p.key, text: out.body }], s.abstracts).map((c) => `copies 12+ words from ${c.citation_id}`)];
}
type Generate = typeof generateJson;

/** At most 3 batched calls for the plan, then one batched retry for every failing section. A section that still fails is `needs_edit`; the draft never fails whole. */
export async function writeSections(strategy: StrategyDraft, snapshot: Snapshot, generate: Generate = generateJson, budget?: number): Promise<ApplicationResult> {
  const plan = planSections(strategy, snapshot), meta: LlmMeta[] = [], got = new Map<string, SectionOut>(), rounds = Object.fromEntries(plan.map((p) => [p.key, 1]));
  let calls = 0;
  const call = async (batch: SectionPlan[], failures: string[] = []) => {
    calls += 1;
    try {
      const res = await generate({ system: SYSTEM, prompt: buildPrompt(snapshot, strategy, batch, failures), schema: SectionsSchema });
      const keys = new Set(batch.map((p) => p.key)), out = SectionsSchema.parse(res.data).sections;
      meta.push(res.meta);
      for (const sec of out) if (keys.has(sec.key)) got.set(sec.key, sec);
    } catch (e) {
      if (!(e instanceof LlmError || e instanceof ZodError)) throw e;
      if (meta.length === 0 && quotaExhausted(e)) return 'quota'; // a failed retry keeps the first-round text for the editor
    }
  };
  for (const batch of batchPlan(plan, budget)) if ((await call(batch)) === 'quota') return { status: 'quota', message: QUOTA_MESSAGE };
  const problems = new Map(plan.map((p) => [p.key, checkSection(p, got.get(p.key), snapshot)]));
  const failing = plan.filter((p) => problems.get(p.key)!.length);
  if (failing.length) {
    await call(failing, failing.flatMap((p) => problems.get(p.key)!.map((x) => `${p.key} (${p.heading}): ${x}`)));
    for (const p of failing) { rounds[p.key] = 2; problems.set(p.key, checkSection(p, got.get(p.key), snapshot)); }
  }
  const sections: Section[] = plan.map((p) => {
    const out = got.get(p.key), reasons = problems.get(p.key)!;
    return { key: p.key, heading: p.heading, criterion: p.criterion, body: out?.body ?? '', citation_ids: out?.citation_ids ?? [], assumptions: out?.assumptions ?? [],
      points: p.points, limit: p.limit, status: reasons.length ? 'needs_edit' : 'ok', reasons };
  });
  const needs = sections.filter((x) => x.status === 'needs_edit').map((x) => x.key);
  return { status: 'DRAFT', sections, validation_report: { ok: needs.length === 0, needs_edit: needs, rounds }, model_meta: { calls, retried: failing.length > 0, calls_detail: meta } };
}

export type StrategyRow = { id: string; org_id: string; opportunity_id: string; status: string; output: unknown; snapshot: unknown };
/** Pure: refuses anything but an approved strategy and returns its stored snapshot as is (never re-gathered), re-checked for privacy. */
export function startFromStrategy(row: StrategyRow): { strategy: StrategyDraft; snapshot: Snapshot } {
  if (row.status !== 'approved') throw new ApplicationError(NOT_APPROVED);
  return { strategy: StrategyDraftSchema.parse(row.output), snapshot: assertPrivate(row.snapshot as Snapshot) };
}

/** Server-side: approved strategy → sections → one `application_draft` row (DRAFT) under the caller's RLS. On quota nothing is stored. */
export async function createApplicationDraft(client: SupabaseClient, strategyDraftId: string, generate: Generate = generateJson): Promise<{ id: string } | { error: string }> {
  const { data: row, error } = await client.from('strategy_draft').select('id,org_id,opportunity_id,status,output,snapshot').eq('id', strategyDraftId).single();
  if (error || !row) throw new ApplicationError(error?.message || 'strategy draft not found');
  const { strategy, snapshot } = startFromStrategy(row as StrategyRow), r = await writeSections(strategy, snapshot, generate);
  if (r.status === 'quota') return { error: r.message };
  const ins = await client.from('application_draft').insert({
    org_id: row.org_id, opportunity_id: row.opportunity_id, strategy_draft_id: row.id, status: 'DRAFT', sections: r.sections, validation_report: r.validation_report, model_meta: r.model_meta,
  }).select('id').single();
  if (ins.error || !ins.data) throw new ApplicationError(ins.error?.message || 'application_draft insert failed');
  return { id: ins.data.id as string };
}
