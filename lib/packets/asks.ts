/** F-403c: the evidence a grant's listing asks for (the fit score's own reading, `askedEvidence`), where the grant packet carries each kind, and
 * whether FAS has enough records loaded to show it (`loadedEvidence`, at least 11 in the last 12 months). Staff-only page note: never in the packet model,
 * so it never reaches the print sheet, the DOCX or the CSV. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { opportunityText } from '../grants/eligibility';
import { loadedEvidence } from '../grants/evidence';
import { askedEvidence } from '../grants/score';
import type { OpportunityInput } from '../grants/types';
import { SECTION_TITLES } from './model';

export type GrantAsk = { kind: string; label: string; section: string; figure: string; loaded: boolean };
/** kind → [words, packet section, the figure in it]. Kinds match `EVIDENCE` in lib/grants/score.ts. */
export const ASK_WHERE: Record<string, [string, string, string]> = {
  outcomes: ['Client outcomes', SECTION_TITLES.outcomes, 'Outcome change'],
  cost: ['Cost evidence', SECTION_TITLES['fas-results'], 'Cost per completed episode'],
  timeliness: ['Wait times', SECTION_TITLES['fas-results'], 'Days from court order to first session'],
};
export function grantAsks(text: string, loaded: string[]): GrantAsk[] {
  return askedEvidence(text).flatMap((kind) => { const w = ASK_WHERE[kind]; return w ? [{ kind, label: w[0], section: w[1], figure: w[2], loaded: loaded.includes(kind) }] : []; });
}
/** null when the listing cannot be read (the note is then left out); a failed evidence count reads as not loaded (`loadedEvidence`). */
export async function loadGrantAsks(client: SupabaseClient, opportunityId: string, orgId: string, now: Date): Promise<GrantAsk[] | null> {
  const { data, error } = await client.from('opportunity').select('description,eligibility,raw').eq('id', opportunityId).maybeSingle();
  if (error || !data) return null;
  const o = data as Pick<OpportunityInput, 'description' | 'eligibility' | 'raw'>;
  return grantAsks(opportunityText({ ...o, eligibility: o.eligibility ?? {} } as OpportunityInput), await loadedEvidence(client, orgId, now));
}
