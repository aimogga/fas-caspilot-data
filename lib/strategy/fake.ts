import type { generateJson } from '../llm';
import type { StrategyDraft } from './schema';
import type { Fact } from './snapshot';

/** Playwright only (`STRATEGY_FAKE_LLM=1`, never in production): a stand-in for the adapter that builds a cited draft from the SNAPSHOT
 * in the prompt, so e2e never calls the network. Every number it writes is a value of the fact it cites. */
export const fakeEnabled = () => process.env.STRATEGY_FAKE_LLM === '1' && process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production';

export const fakeGenerate = (async ({ prompt }: { prompt: string }) => {
  const s = JSON.parse(prompt.split('\n')[1] ?? '{}') as { opportunity_id: string; facts: Fact[] };
  const opp = s.facts.find((f) => f.citation_id.startsWith('opportunity:'));
  const { award_floor: lo, award_ceiling: hi } = opp?.values ?? {};
  const data: StrategyDraft = {
    opportunity_id: s.opportunity_id, status: 'DRAFT',
    criteria_map: [{ criterion: "Fit with the funder's purpose", fas_position: 'FAS pays for therapy for court-involved families in Utah, which this opportunity names.',
      evidence: opp ? [{ claim: lo != null && hi != null ? `The award range runs from $${lo.toLocaleString('en-US')} to $${hi.toLocaleString('en-US')}.` : 'The funder published this opportunity.', citation_id: opp.citation_id }] : [],
      gaps: ['No outcome trend for the last four quarters yet.'], confidence: 'medium' }],
    suggested_ask: opp && lo != null && hi != null ? { low: lo, high: hi, basis_citation_ids: [opp.citation_id] } : null,
    risks: ['Few similar awards went to Utah organizations.'], narrative_outline: ['Need in the counties FAS serves', 'How FAS pays for therapy', 'What the award would fund'],
    inferences: ['Inference: reviewers may weigh rural reach heavily.'],
  };
  return { data, meta: { provider: 'gemini', model: 'e2e-fake', attempts: 1, input_tokens: null, output_tokens: null, latency_ms: 0 } };
}) as unknown as typeof generateJson;
