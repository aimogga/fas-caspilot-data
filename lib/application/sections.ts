import type { StrategyDraft } from '../strategy/schema';
import type { Fact, Snapshot } from '../strategy/snapshot';

/** A section's length limit as the funder states it. `none_stated` is never guessed into a number. */
export type Limit =
  | { kind: 'words' | 'pages' | 'characters'; value: number; max_words: number | null; max_chars: number | null }
  | { kind: 'none_stated' };
export type SectionPlan = { key: string; heading: string; criterion: string; points: number | null; limit: Limit; citation_id: string | null };

export const WORDS_PER_PAGE = 500;

/** Pure: the first stated limit in a funder's text ("not to exceed 500 words", "2 pages", "5,000 characters"). Pages convert at `wordsPerPage`. */
export function parseLimits(text: string | null | undefined, wordsPerPage = WORDS_PER_PAGE): Limit {
  const m = /(\d{1,3}(?:,\d{3})+|\d+)[\s-]*(word|page|character)s?\b/i.exec(text ?? '');
  if (!m) return { kind: 'none_stated' };
  const value = Number((m[1] as string).replace(/,/g, '')), unit = (m[2] as string).toLowerCase();
  if (unit === 'character') return { kind: 'characters', value, max_words: null, max_chars: value };
  return unit === 'page' ? { kind: 'pages', value, max_words: value * wordsPerPage, max_chars: null } : { kind: 'words', value, max_words: value, max_chars: null };
}

const POINTS = /\s*\((\d+)\s*(?:pts?|points?)\)\s*$/i;
const norm = (s: string) => s.replace(POINTS, '').trim().toLowerCase();

/** Pure: one section per criterion in the approved strategy's criteria_map, in its order. Points and limits come from the stored opportunity_criteria fact when it matches. */
export function planSections(strategy: StrategyDraft, snapshot: Snapshot, wordsPerPage = WORDS_PER_PAGE): SectionPlan[] {
  const criteria = snapshot.facts.filter((f) => f.citation_id.startsWith('opportunity_criteria:'));
  return strategy.criteria_map.map((c, i) => {
    const fact: Fact | undefined = criteria.find((f) => norm(f.label) === norm(c.criterion));
    const stated = POINTS.exec(c.criterion)?.[1];
    return {
      key: `s${i + 1}`, heading: fact?.label ?? c.criterion.replace(POINTS, '').trim(), criterion: c.criterion,
      points: fact?.values.weight_points ?? (stated ? Number(stated) : null), limit: parseLimits(fact?.text, wordsPerPage), citation_id: fact?.citation_id ?? null,
    };
  });
}

export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
/** Words a section is expected to take: its limit, or a default when none is stated (characters at ~6 per word). */
export const estimateWords = (p: SectionPlan, fallback = 400) => (p.limit.kind === 'none_stated' ? fallback : p.limit.max_words ?? Math.ceil((p.limit.max_chars ?? 0) / 6));

/** Splits the plan into as few calls as fit `budget` output words, never more than `maxCalls` (contiguous, near-equal batches). */
export function batchPlan(plan: SectionPlan[], budget = 3000, maxCalls = 3): SectionPlan[][] {
  if (!plan.length) return [];
  const n = Math.min(maxCalls, plan.length, Math.max(1, Math.ceil(plan.reduce((t, p) => t + estimateWords(p), 0) / budget)));
  const size = Math.ceil(plan.length / n);
  return Array.from({ length: Math.ceil(plan.length / size) }, (_, i) => plan.slice(i * size, (i + 1) * size));
}

/** Problems with a section's length against its limit (empty when within it or none stated). */
export function limitProblems(p: SectionPlan, body: string): string[] {
  if (p.limit.kind === 'none_stated') return [];
  const w = wordCount(body), { max_words: mw, max_chars: mc } = p.limit;
  return [...(mw !== null && w > mw ? [`${w} words is over the ${mw}-word limit`] : []), ...(mc !== null && body.length > mc ? [`${body.length} characters is over the ${mc}-character limit`] : [])];
}
