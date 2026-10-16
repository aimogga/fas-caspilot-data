/** DS-13b: the board page as four numbered sections in words. Each opens with its `summary.ts` sentence (the finding), then a supporting sentence,
 * then the pictures from `pictures.ts`. Pure; a failed view is `error`, nothing loaded is `not-available`; no sentence is ever invented. */
import { NOT_AVAILABLE } from '../dashboard/cards';
import type { DashboardMetrics } from '../dashboard/metrics-query';
import { whyHidden } from '../trust/glossary';
import type { BoardCounties } from './counties';
import type { Picture } from './pictures';
import { sentences } from './summary';

export type SectionId = 'improve' | 'wait' | 'dollars' | 'need';
export type BoardSection = { id: SectionId; no: number; question: string; finding: string; support: string | null; state: 'value' | 'not-available' | 'error'; pictures: Picture['id'][] };
export const QUESTIONS: Record<SectionId, string> = { improve: 'Did families improve?', wait: 'How long families waited', dollars: 'Where our therapy dollars went', need: 'Need in the counties we serve' };
/** One sentence of what the page shows; the privacy rule sits in the header line. */
export const LEAD = 'Four pictures tell the quarter: whether families improved, how long they waited, where the therapy dollars went and where need is greatest in the counties we serve.';
const failed = (x: DashboardMetrics | null, k: 'm1' | 'm4' | 'm6'): boolean => !!x && 'error' in x[k];
/** The metric sections in reading order; the county section is appended from `boardCounties`. */
export function boardSections(x: DashboardMetrics | null, counties: BoardCounties): BoardSection[] {
  const section = (id: SectionId, no: number, key: 'm1' | 'm4' | 'm6', finding: string | null, support: string | null, pictures: Picture['id'][]): BoardSection => {
    const state = failed(x, key) ? 'error' : finding ? 'value' : 'not-available';
    return { id, no, question: QUESTIONS[id], finding: finding ?? NOT_AVAILABLE, support: state === 'value' ? support : state === 'error' ? whyHidden('error') : whyHidden('not_available'), state, pictures: state === 'value' ? pictures : [] };
  };
  return [
    section('improve', 1, 'm4', sentences.m4(x?.m4), sentences.o1(x?.o1), ['completion', 'outcomes']),
    section('wait', 2, 'm1', sentences.m1(x?.m1), sentences.m2(x?.m2), ['wait']),
    section('dollars', 3, 'm6', sentences.m6(x?.m6), sentences.m5(x?.m5), ['dollars']),
    { id: 'need', no: 4, question: QUESTIONS.need, finding: counties.finding, support: counties.support, state: counties.state === 'value' ? 'value' : 'not-available', pictures: [] },
  ];
}
