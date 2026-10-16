import type { DashboardMetrics } from '../dashboard/metrics-query';
import { generateJson, LlmError, type Provider } from '../llm';
import { generateDraft, type DraftResult } from './generate';
import { StrategyDraftSchema } from './schema';
import { assembleSnapshot, type Snapshot, type SnapshotInput } from './snapshot';

/** F-508i: the D-003 bake-off. Same 5 public opportunities, each provider forced in turn (eval only, LLM_EVAL=1). */
export const PROVIDERS: Provider[] = ['gemini', 'openrouter'];
export const CALL_CAP = 20; // 5 opportunities x 2 rounds x 2 providers; OpenRouter stays at 10 or fewer, inside the #227 guard
export const SPACING_MS = 4_000;
export const DECISION_RULE = 'The provider with higher citation accuracy wins; a tie goes to the higher QA rubric mean (D-003 memo).';
const KEYS: Record<Provider, string> = { gemini: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY' };
/** A 402/429 answer or an OpenRouter guard refusal (#227) ends that provider's runs. */
const QUOTA = new Set<unknown>([402, 429, 'paid_model_refused', 'openrouter_quota_exhausted', 'openrouter_cooldown', 'openrouter_disabled_today']);

export type EvalItem = { key: string; kind: 'federal' | 'utah' | 'foundation'; source_url: string; fetched_at: string; snapshot: Snapshot };
type Fixture = {
  opportunities: { key: string; kind: EvalItem['kind']; source_url: string; fetched_at: string; opportunity: SnapshotInput['opportunity']; criteria: SnapshotInput['criteria'] }[];
  synthetic: Pick<SnapshotInput, 'indicators' | 'similar' | 'summary' | 'period'> & { metrics: unknown; now: string };
};

/** Builds each opportunity's snapshot with lib/strategy from the fixture's synthetic aggregates (assertPrivate runs inside). */
export function buildItems(fx: Fixture): EvalItem[] {
  const { metrics, now, ...agg } = fx.synthetic;
  return fx.opportunities.map((o) => ({
    key: o.key, kind: o.kind, source_url: o.source_url, fetched_at: o.fetched_at,
    snapshot: assembleSnapshot({ ...agg, opportunity: o.opportunity, criteria: o.criteria, metrics: metrics as DashboardMetrics, now: new Date(now) }),
  }));
}

export type Score = {
  schema_valid: boolean; numbers_present: number; numbers_resolving: number; citation_accuracy: number | null;
  copy_hits: number; inferences_separated: number; inferences_misplaced: number; latency_ms: number; input_tokens: number; output_tokens: number; rounds: number;
};
const INFER = /^\s*inference:/i;

/** Automatic scores for one draft. Citation accuracy = numbers resolving to a cited value / numbers present (lib/strategy citations). */
export function scoreRun(r: DraftResult): Score {
  const claims = r.citation_report.claims, present = claims.reduce((n, c) => n + c.numbers.length, 0);
  // A citation that does not resolve leaves no facts, so each of its numbers is already "has no matching cited value".
  const unresolved = claims.reduce((n, c) => n + c.problems.filter((p) => p.endsWith('has no matching cited value')).length, 0);
  const o = r.output, sum = (k: 'latency_ms' | 'input_tokens' | 'output_tokens') => r.model_meta.reduce((n, m) => n + (m[k] ?? 0), 0);
  const stated = o ? o.criteria_map.flatMap((c) => [c.fas_position, ...c.evidence.map((e) => e.claim)]) : [];
  return {
    schema_valid: !!o && StrategyDraftSchema.safeParse(o).success, numbers_present: present, numbers_resolving: present - unresolved,
    citation_accuracy: present ? (present - unresolved) / present : null, copy_hits: r.citation_report.copied.length,
    inferences_separated: o ? o.inferences.filter((t) => INFER.test(t)).length : 0, inferences_misplaced: stated.filter((t) => /\binference:/i.test(t)).length,
    latency_ms: sum('latency_ms'), input_tokens: sum('input_tokens'), output_tokens: sum('output_tokens'), rounds: r.citation_report.rounds ?? r.model_meta.length,
  };
}

export type Run = { provider: Provider; key: string; kind: EvalItem['kind'] } & (
  { skipped: false; status: DraftResult['status']; score: Score; draft: DraftResult } | { skipped: true; reason: 'missing_key' | 'quota' | 'call_cap' });
type Deps = { generate?: typeof generateJson; sleep?: (ms: number) => Promise<void>; clock?: () => number; env?: Record<string, string | undefined>; cap?: number; spacingMs?: number };
class CapReached extends Error {}
/** Not an LlmError, so generateDraft rethrows it at once instead of spending a second round on a refusing provider. */
class QuotaHit extends Error {}

/** Sequential: provider by provider, opportunity by opportunity, at most one call every `spacingMs`, `cap` calls in all.
 * A missing key, a 402/429 quota answer or guard refusal, or the cap skips the rest of that provider's runs (or all runs, for the cap) and says why. */
export async function runBakeoff(items: EvalItem[], deps: Deps = {}): Promise<Run[]> {
  const { generate = generateJson, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), clock = Date.now, env = process.env, cap = CALL_CAP, spacingMs = SPACING_MS } = deps;
  const runs: Run[] = [];
  let calls = 0, last = -Infinity, capped = false;
  for (const provider of PROVIDERS) {
    let stop: 'missing_key' | 'quota' | null = env[KEYS[provider]] ? null : 'missing_key';
    for (const it of items) {
      const base = { provider, key: it.key, kind: it.kind };
      if (capped || stop) { runs.push({ ...base, skipped: true, reason: capped ? 'call_cap' : (stop as 'missing_key' | 'quota') }); continue; }
      const forced: typeof generateJson = async (input) => {
        if (calls >= cap) throw new CapReached();
        const wait = last + spacingMs - clock();
        if (wait > 0) await sleep(wait);
        calls += 1; last = clock();
        try { return await generate(input, { forceProvider: provider }); } catch (e) {
          throw e instanceof LlmError && e.attempts.some((a) => QUOTA.has(a.status)) ? new QuotaHit() : e;
        }
      };
      try {
        const draft = await generateDraft(it.snapshot, forced);
        runs.push({ ...base, skipped: false, status: draft.status, score: scoreRun(draft), draft });
      } catch (e) {
        if (e instanceof QuotaHit) { stop = 'quota'; runs.push({ ...base, skipped: true, reason: 'quota' }); continue; }
        if (!(e instanceof CapReached)) throw e;
        capped = true; runs.push({ ...base, skipped: true, reason: 'call_cap' });
      }
    }
  }
  return runs;
}

export type ProviderSummary = {
  runs: number; skipped: number; schema_valid: number; drafts_ok: number; numbers_present: number; numbers_resolving: number; citation_accuracy: number | null;
  copy_hits: number; inferences_separated: number; inferences_misplaced: number; mean_latency_ms: number | null; input_tokens: number; output_tokens: number;
};
export function summarize(runs: Run[], provider: Provider): ProviderSummary {
  const mine = runs.filter((r) => r.provider === provider), done = mine.flatMap((r) => (r.skipped ? [] : [r]));
  const t = (k: keyof Score) => done.reduce((n, r) => n + Number(r.score[k]), 0);
  const present = t('numbers_present'), resolving = t('numbers_resolving');
  return {
    runs: done.length, skipped: mine.length - done.length, schema_valid: t('schema_valid'), drafts_ok: done.filter((r) => r.status === 'DRAFT').length,
    numbers_present: present, numbers_resolving: resolving, citation_accuracy: present ? resolving / present : null, copy_hits: t('copy_hits'),
    inferences_separated: t('inferences_separated'), inferences_misplaced: t('inferences_misplaced'),
    mean_latency_ms: done.length ? Math.round(t('latency_ms') / done.length) : null, input_tokens: t('input_tokens'), output_tokens: t('output_tokens'),
  };
}

/** Automatic leader by citation accuracy; `null` (a tie or no data) means the QA rubric mean decides. */
export function leader(s: Record<Provider, ProviderSummary>): Provider | null {
  const g = s.gemini.citation_accuracy, o = s.openrouter.citation_accuracy;
  if (g === null || o === null || g === o) return null;
  return g > o ? 'gemini' : 'openrouter';
}

export function buildReport(runs: Run[], items: EvalItem[], date: string) {
  const providers = Object.fromEntries(PROVIDERS.map((p) => [p, summarize(runs, p)])) as Record<Provider, ProviderSummary>;
  return {
    feature: 'F-508i', date, decision_rule: DECISION_RULE, call_cap: CALL_CAP, spacing_ms: SPACING_MS, providers, automatic_leader: leader(providers),
    opportunities: items.map(({ key, kind, source_url, fetched_at }) => ({ key, kind, source_url, fetched_at })),
    runs: runs.map((r) => (r.skipped ? r : { provider: r.provider, key: r.key, kind: r.kind, skipped: false, status: r.status, score: r.score, draft: `llm-bakeoff-${date}/${r.provider}-${r.key}.json` })),
  };
}
export type Report = ReturnType<typeof buildReport>;

const pct = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(1)}%`);
export function markdown(r: Report): string {
  const rows = PROVIDERS.map((p) => {
    const s = r.providers[p];
    const cells = [p, s.runs, s.skipped, `${s.schema_valid}/${s.runs}`, s.drafts_ok, `${pct(s.citation_accuracy)} (${s.numbers_resolving}/${s.numbers_present})`,
      s.copy_hits, `${s.inferences_separated} / ${s.inferences_misplaced}`, s.mean_latency_ms ?? '—', `${s.input_tokens} / ${s.output_tokens}`];
    return `| ${cells.join(' | ')} |`;
  });
  const skipped = r.runs.filter((x) => x.skipped).map((x) => `- ${x.provider} · ${x.key}: skipped (${'reason' in x ? x.reason : ''})`);
  return [`# LLM bake-off ${r.date} (F-508i, D-003)`, '', `Decision rule: ${r.decision_rule}`, `Automatic leader: ${r.automatic_leader ?? 'none (tie or no data): the rubric mean decides'}`, '',
    '| Provider | Runs | Skipped | Schema valid | DRAFT | Citation accuracy | Copy hits | Inferences separated / misplaced | Mean latency ms | Tokens in / out |',
    '|---|---|---|---|---|---|---|---|---|---|', ...rows, '', '## Skipped runs', ...(skipped.length ? skipped : ['- none']), '',
    'Drafts for the human review are beside this file; score them with harness/audits/llm-bakeoff-rubric.md.', ''].join('\n');
}

/** Every file the script writes, relative to harness/audits/. */
export function outputs(r: Report, runs: Run[]): { path: string; content: string }[] {
  const drafts = runs.flatMap((x) => (x.skipped ? [] : [{ path: `llm-bakeoff-${r.date}/${x.provider}-${x.key}.json`, content: `${JSON.stringify(x.draft, null, 1)}\n` }]));
  return [{ path: `llm-bakeoff-${r.date}.json`, content: `${JSON.stringify(r, null, 1)}\n` }, { path: `llm-bakeoff-${r.date}.md`, content: markdown(r) }, ...drafts];
}
