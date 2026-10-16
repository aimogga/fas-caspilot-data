import type { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { generateJson, LlmError, type LlmMeta } from '../llm';
import { validateDraft, type CitationReport } from './citations';
import { StrategyDraftSchema, type StrategyDraft } from './schema';
import { loadSnapshot, type Snapshot } from './snapshot';

export const SYSTEM = [
  'You draft a grant response strategy for Family Advocacy Services (FAS), a Utah nonprofit that pays for therapy for families. Answer with JSON matching the schema.',
  'Use only the facts in SNAPSHOT. Every evidence claim cites exactly one citation_id from SNAPSHOT.',
  'Every number in fas_position, evidence claims and suggested_ask must be a value of a cited fact (fas_position may use only its own evidence). Never invent statistics.',
  'suggested_ask.low and .high must be amounts from the facts in basis_citation_ids (for example the award history median, range or the award ceiling); use null when no basis exists.',
  'Put anything you guess or infer that SNAPSHOT does not state in inferences, each starting with "Inference:".',
  "Position FAS against the opportunity's published criteria. You do not know what past winners wrote; never copy text from other organizations' award descriptions or abstracts.",
  'status is always "DRAFT" and opportunity_id is the SNAPSHOT opportunity_id.',
].join('\n');

/** The model sees the facts only; abstracts stay out of the prompt and feed the copy guard. */
export function buildPrompt(s: Snapshot, failures: string[] = []): string {
  const retry = failures.length ? `\n\nYour previous draft was rejected. Fix these and cite only SNAPSHOT values:\n- ${failures.join('\n- ')}` : '';
  return `SNAPSHOT\n${JSON.stringify({ opportunity_id: s.opportunity_id, facts: s.facts })}${retry}`;
}

export function failureLines(r: CitationReport): string[] {
  return [...r.claims.flatMap((c) => c.problems.map((p) => `${c.path}: ${p}`)), ...r.copied.map((c) => `${c.path}: copies 12+ words from ${c.citation_id}`)];
}

export type DraftResult = { status: 'DRAFT' | 'failed'; output: StrategyDraft | null; citation_report: CitationReport; model_meta: LlmMeta[] };
type Generate = typeof generateJson;

/** Generates, validates, and regenerates once with the failures listed. A second failure is `failed` and never usable. */
export async function generateDraft(snapshot: Snapshot, generate: Generate = generateJson): Promise<DraftResult> {
  const meta: LlmMeta[] = [];
  let failures: string[] = [], last: Pick<DraftResult, 'output' | 'citation_report'> = { output: null, citation_report: { ok: false, claims: [], copied: [] } };
  for (let round = 1; round <= 2; round++) {
    try {
      const res = await generate({ system: SYSTEM, prompt: buildPrompt(snapshot, failures), schema: StrategyDraftSchema });
      meta.push(res.meta);
      const output = StrategyDraftSchema.parse(res.data), report = { ...validateDraft(output, snapshot), rounds: round };
      if (report.ok) return { status: 'DRAFT', output, citation_report: report, model_meta: meta };
      last = { output, citation_report: report };
      failures = failureLines(report);
    } catch (e) {
      if (!(e instanceof LlmError || e instanceof ZodError)) throw e;
      last = { output: null, citation_report: { ok: false, claims: [], copied: [], rounds: round, error: e instanceof LlmError ? e.attempts : 'invalid_schema' } };
      failures = ['The previous answer did not match the JSON schema.'];
    }
  }
  return { status: 'failed', ...last, model_meta: meta };
}

/** Server-side: snapshot → draft → one `strategy_draft` row (DRAFT or failed) under the caller's RLS. */
export async function createStrategyDraft(client: SupabaseClient, orgId: string, opportunityId: string, now = new Date(), generate: Generate = generateJson) {
  const snapshot = await loadSnapshot(client, opportunityId, now);
  return saveDraft(client, orgId, snapshot, await generateDraft(snapshot, generate));
}

export async function saveDraft(client: SupabaseClient, orgId: string, snapshot: Snapshot, r: DraftResult): Promise<{ id: string; status: DraftResult['status'] }> {
  const { data, error } = await client.from('strategy_draft').insert({
    org_id: orgId, opportunity_id: snapshot.opportunity_id, status: r.status, output: r.output, snapshot, citation_report: r.citation_report, model_meta: r.model_meta,
  }).select('id,status').single();
  if (error || !data) throw new Error(error?.message || 'strategy_draft insert failed');
  return data as { id: string; status: DraftResult['status'] };
}
