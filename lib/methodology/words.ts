/** Plain words for the methodology page (DS-16b, D-040): statistical terms, weight cards and section headlines in words. Pure. */
import { needTerm } from '../need-map/terms';
import { type Term, whyHidden } from '../trust/glossary';
import { ALIAS } from './labels';
import { NOT_PUBLISHED } from '../need-map/query';
import type { NeedParams } from '../need-score/compute';
import type { InputRow, MethodologyView, WeightRow } from './query';

/** One sentence for each statistical word in the "How we calculate it" paragraph; the trigger is the word itself. */
export const STAT_TERMS = {
  z_score: 'A z-score says how far one county sits from the typical Utah county on one input, measured in standard deviations. Zero is typical; above zero is more than typical.',
  average: 'The mean of this input across the Utah counties with a published value: add the values up and divide by the count.',
  sd: "The usual distance between a county's value and the statewide average. One step is a normal gap; two is a wide one.",
  weight: 'How many of the 100 points an input contributes. An input with 30 points sways the score three times as much as one with 10.',
  rank: 'Counties are placed in order from the highest score to the lowest. Rank 1 is the highest need relative to other Utah counties, not a fixed level of need.',
} as const;
export const SYNTHETIC_HINT = "Example data made for previews. The weights, scores and dates on this page are not FAS's real settings.";
export const NEVER_LOADED = 'This source has not loaded successfully yet, so there is no release or date to show.';

/** The DS-11a indicator term for a weight key (`uninsured` is an alias of `uninsured_rate`); an unknown key falls back to its label. */
export const inputTerm = (key: string, label: string): Term => needTerm(`ind:${ALIAS[key] ?? key}`, label);

/** `30 of 100 points`, or Not published when the stored weights sum to zero. */
export const pointsText = (points: number | null): string => (points == null ? NOT_PUBLISHED : `${points} of 100 points`);

export type WeightCard = { key: string; term: Term; points: string; hidden?: string; source: string; asOf: string; version: string };
/** One card per weight: the indicator's words, the points, the version it was approved in, and the input's source line. */
export function weightCards(view: Pick<MethodologyView, 'weights' | 'inputs' | 'version' | 'approvedLabel'>): WeightCard[] {
  return view.weights.map((w: WeightRow) => {
    const input = view.inputs.find((i: InputRow) => i.key === w.key);
    const source = input && input.source !== '—' ? `${input.source} ${input.vintage}` : NOT_PUBLISHED;
    return { key: w.key, term: inputTerm(w.key, w.label), points: pointsText(w.points), hidden: w.points == null ? whyHidden('not_published') : undefined, source, asOf: input?.asOf ?? '—', version: `Need score version ${view.version}, approved ${view.approvedLabel}` };
  });
}

const plural = (n: number, word: string) => `${n === 1 ? 'one' : n} ${word}${n === 1 ? '' : 's'}`;
/** Serif headlines in words, one per section, from the stored view. */
export function headlines(view: Pick<MethodologyView, 'weights' | 'inputs'>): Record<'how' | 'inputs' | 'weights' | 'reliability' | 'vintages' | 'limits', string> {
  const top = Math.max(...view.weights.map((w) => w.points ?? -1));
  const leaders = view.weights.filter((w) => w.points === top).map((w) => w.label);
  const weights = top < 0 || !leaders.length ? 'Weights are not available yet.'
    : view.weights.length === 1 ? `${leaders[0]} carries all 100 points in this version.`
    : leaders.length === 1 ? `${leaders[0]} counts most, at ${top} of 100 points.`
    : `${leaders.slice(0, -1).join(', ')} and ${leaders[leaders.length - 1]} count most, at ${top} of 100 points each.`;
  return {
    how: `How we turn ${plural(view.inputs.length, 'public input')} into one county rank`,
    inputs: 'What goes into the score', weights, reliability: 'How we stop one county pulling the rest, and flag noisy estimates', vintages: 'When each input was published and last loaded', limits: 'What this score cannot tell you',
  };
}

/** The summary strip under the header: version and approval, inputs and points, counties scored. */
export function summary(view: Pick<MethodologyView, 'version' | 'approvedLabel' | 'inputs' | 'scored' | 'counties'>): string[] {
  return [`Version ${view.version}, approved ${view.approvedLabel}`, `${plural(view.inputs.length, 'input')}, 100 points`, `${view.scored} of ${view.counties} counties scored`];
}

/** F-210c: the cap and the reliability check in plain words, from the approved version's stored params (golden rule 4). */
export function reliabilityWords(params: NeedParams): { cap: string; flag: string } {
  const cap = params.z_cap === undefined
    ? 'This version does not cap z-scores, so a county with an extreme value counts at its full distance from the average.'
    : `This version caps every z-score at ${params.z_cap} standard deviations either side of the average. `
      + `A small county with an extreme estimate would otherwise stretch the scale and pull every other county's score; `
      + `with the cap it still counts, and is still ranked, but at most ${params.z_cap} steps out.`;
  const flag = params.cv_flag_pct === undefined
    ? 'This version does not check how reliable each estimate is.'
    : 'We also check how noisy each estimate is. The Census publishes a margin of error; we turn it into a coefficient of variation (CV), '
      + `the uncertainty as a share of the estimate: (margin ÷ 1.645) ÷ value × 100. When the CV is above ${params.cv_flag_pct}%, `
      + 'that county gets a "Low reliability" marker on that input. It is still scored and never hidden.';
  return { cap, flag };
}
