import { z } from 'zod';

/** The strategy draft output schema from docs/GRANT_MATCHING.md ("Strategy draft"). `suggested_ask` is null when no basis is cited. */
export const StrategyDraftSchema = z.object({
  opportunity_id: z.string(),
  status: z.literal('DRAFT'),
  criteria_map: z.array(z.object({
    criterion: z.string(),
    fas_position: z.string(),
    evidence: z.array(z.object({ claim: z.string(), citation_id: z.string() })),
    gaps: z.array(z.string()),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  suggested_ask: z.object({ low: z.number(), high: z.number(), basis_citation_ids: z.array(z.string()) }).nullable(),
  risks: z.array(z.string()),
  narrative_outline: z.array(z.string()),
  inferences: z.array(z.string()),
});
export type StrategyDraft = z.infer<typeof StrategyDraftSchema>;
