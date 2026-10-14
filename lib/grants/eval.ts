// F-509: grant match eval (docs/GRANT_MATCHING.md "Evaluation"). Pure: labels + config + profile + a fixed `now` → one deterministic report.
// A prediction is `good` when score ≥ threshold (`params.eval_threshold`, default 60 = the digest threshold); eligibility accuracy compares
// `checkEligibility().eligible` to each label's `eligible_expected`. The committed golden (`tests/golden/match-eval.json`) pins `misses`.
import { checkEligibility } from './eligibility';
import { type MatchConfig, scoreOpportunity } from './score';
import type { OpportunityInput, OrgProfile, Unknown } from './types';

export type EvalLabel = OpportunityInput & { id: string; label: 'good' | 'poor'; why: string; eligible_expected: boolean | Unknown };
export type EvalLabels = { as_of: string; labels: EvalLabel[] };
export type EvalMiss = { id: string; label: 'good' | 'poor'; score: number; eligible: boolean | Unknown; why: string };
export type EvalReport = {
  n: number; threshold: number; precision: number; recall: number; f1: number; eligibilityAccuracy: number;
  confusion: { tp: number; fp: number; fn: number; tn: number }; misses: EvalMiss[];
};
export const DEFAULT_EVAL_THRESHOLD = 60;
export const EVAL_BARS = { precision: 0.7, recall: 0.5, eligibilityAccuracy: 0.9 };

const ratio = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 1e4) / 1e4);

export function runEval(labels: EvalLabel[], config: MatchConfig, profile: OrgProfile, now: Date): EvalReport {
  const threshold = (config.params as { eval_threshold?: number } | undefined)?.eval_threshold ?? DEFAULT_EVAL_THRESHOLD;
  const confusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
  const misses: EvalMiss[] = [];
  let eligibilityHits = 0;
  for (const l of labels) {
    const e = checkEligibility(l, profile, now);
    const { score } = scoreOpportunity(l, profile, e, config, now);
    const predictedGood = score >= threshold;
    const isGood = l.label === 'good';
    if (predictedGood && isGood) confusion.tp += 1; else if (predictedGood) confusion.fp += 1; else if (isGood) confusion.fn += 1; else confusion.tn += 1;
    if (predictedGood !== isGood) misses.push({ id: l.id, label: l.label, score, eligible: e.eligible, why: l.why });
    if (e.eligible === l.eligible_expected) eligibilityHits += 1;
  }
  const precision = ratio(confusion.tp, confusion.tp + confusion.fp);
  const recall = ratio(confusion.tp, confusion.tp + confusion.fn);
  const f1 = ratio(2 * precision * recall, precision + recall);
  return { n: labels.length, threshold, precision, recall, f1, eligibilityAccuracy: ratio(eligibilityHits, labels.length), confusion, misses };
}

/** Plain-text table for the PR body and CI log. */
export function formatReport(r: EvalReport, configId = 'config'): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const bar = (k: keyof typeof EVAL_BARS) => `${pct(r[k])} (bar ${pct(EVAL_BARS[k])}, ${r[k] >= EVAL_BARS[k] ? 'PASS' : 'FAIL'})`;
  const lines = [
    `Grant match eval: ${configId}, n=${r.n}, threshold ${r.threshold}`,
    `metric | value`, `--- | ---`,
    `precision | ${bar('precision')}`, `recall | ${bar('recall')}`, `f1 | ${pct(r.f1)}`, `eligibility accuracy | ${bar('eligibilityAccuracy')}`,
    `confusion | tp=${r.confusion.tp} fp=${r.confusion.fp} fn=${r.confusion.fn} tn=${r.confusion.tn}`,
    `misses (${r.misses.length}) | id · label · score · eligible · why`,
    ...r.misses.map((m) => `  ${m.id} | ${m.label} · ${m.score} · ${m.eligible} · ${m.why}`),
  ];
  return lines.join('\n');
}
