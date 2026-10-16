// F-506b: who wins, and how they compare to FAS. Pure: match a past award recipient to a ProPublica candidate, map its Form 990 facts to a
// `recipient_profile` row, and word one comparison sentence with a `source_ref`, in the `similarAwards` style. No officer names or compensation.
import { ProPublica, capacityBand, nameScore, type FunderCandidate, type FunderProfile } from '../../packages/ingest/propublica';
import type { OrgProfile } from './types';
export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';
export type MatchMethod = 'exact_name_state' | 'fuzzy_name_state' | 'name_other_state' | 'none';
export type RecipientMatch = { candidate: FunderCandidate | null; method: MatchMethod; confidence: MatchConfidence };
export type AwardRecipient = { id: string; recipient: string; recipient_state: string | null };
export type RecipientProfileRow = { award_history_id: string; recipient_key: string; recipient: string; ein: string | null; matched_name: string | null; state: string | null;
  ntee_code: string | null; ruling_year: number | null; latest_tax_year: number | null; total_revenue: number | null; total_expenses: number | null; program_service_expenses: number | null;
  contributions_share: number | null; match_method: MatchMethod; match_confidence: MatchConfidence; source_url: string | null; fetched_at: string };
export type StoredRecipientProfile = RecipientProfileRow & { id: string; ingest_run_id: string | null };
export type FasComparison = { reason: string; source_ref: string; attribution: string };
/** ProPublica Data Terms of Use: credit the source wherever these facts are shown. */
export const PROPUBLICA_ATTRIBUTION = 'Form 990 data: ProPublica Nonprofit Explorer (projects.propublica.org/nonprofits), used under the ProPublica Data Terms of Use.';
export const CACHE_DAYS = 30;
const LEGAL = /\b(the|inc|incorporated|corp|corporation|co|company|llc|ltd)\b/g;
/** Lower case, `&` → and, punctuation and legal suffixes dropped, single spaces: the basis for an "exact" name. */
export const normalizeName = (s: string): string => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(LEGAL, ' ').replace(/\s+/g, ' ').trim();
export const recipientKey = (name: string, state: string | null): string => `${normalizeName(name)}|${state?.trim().toUpperCase() ?? ''}`;
export const isFresh = (fetchedAt: string, now: Date, days = CACHE_DAYS): boolean => now.getTime() - new Date(fetchedAt).getTime() < days * 86_400_000;
const RANK: Record<MatchConfidence, number> = { high: 3, medium: 2, low: 1, none: 0 };
/** high = exact normalized name + same state; medium = fuzzy name (ProPublica.MIN_SCORE) + same state; low = either name rule in another or unknown state; none = no candidate. */
export function matchRecipient(name: string, state: string | null, cands: FunderCandidate[]): RecipientMatch {
  const want = normalizeName(name), st = state?.trim().toUpperCase() || null;
  const ranked = cands.map((c) => {
    const exact = normalizeName(c.name) === want, s = exact ? 1 : nameScore(name, c.name), same = !!st && c.state === st;
    const [method, confidence]: [MatchMethod, MatchConfidence] = !exact && s < ProPublica.MIN_SCORE ? ['none', 'none'] : !same ? ['name_other_state', 'low'] : exact ? ['exact_name_state', 'high'] : ['fuzzy_name_state', 'medium'];
    return { candidate: c, method, confidence, s };
  }).filter((m) => m.confidence !== 'none').sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || b.s - a.s || (b.candidate.score ?? 0) - (a.candidate.score ?? 0));
  return ranked[0] ? { candidate: ranked[0].candidate, method: ranked[0].method, confidence: ranked[0].confidence } : { candidate: null, method: 'none', confidence: 'none' };
}
/** One `recipient_profile` row; with no match (or no organization) every 990 fact is null and confidence is `none`, so the gap is stored, not hidden. */
export function toProfileRow(award: AwardRecipient, match: RecipientMatch, org: FunderProfile | null, now: Date): RecipientProfileRow {
  const hit = match.confidence !== 'none' && org ? org : null, f = hit?.filings[0], share = f?.contributions != null && f.total_revenue ? f.contributions / f.total_revenue : null;
  return { award_history_id: award.id, recipient_key: recipientKey(award.recipient, award.recipient_state), recipient: award.recipient, ein: hit?.ein ?? null, matched_name: hit?.name ?? null,
    state: hit?.state ?? null, ntee_code: hit?.ntee_code ?? null, ruling_year: hit?.ruling_year ?? null, latest_tax_year: f?.tax_year ?? null, total_revenue: f?.total_revenue ?? null,
    total_expenses: f?.total_expenses ?? null, program_service_expenses: f?.program_expenses ?? null, contributions_share: share === null ? null : Math.round(Math.min(1, Math.max(0, share)) * 1000) / 1000,
    match_method: hit ? match.method : 'none', match_confidence: hit ? match.confidence : 'none', source_url: hit ? `https://projects.propublica.org/nonprofits/organizations/${hit.ein}` : null, fetched_at: now.toISOString() };
}
/** $2.1M, $600K, $950. */
export const money = (n: number): string => (n >= 1e6 ? `$${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
/** One sentence on size: winner's latest 990 expenses and band vs FAS's budget and band, the ratio, and the match confidence. Pure. */
export function compareToFas(p: StoredRecipientProfile, org: OrgProfile): FasComparison {
  const base = { source_ref: `recipient_profile:${p.id}`, attribution: PROPUBLICA_ATTRIBUTION }, budget = typeof org.annual_budget_usd === 'number' ? org.annual_budget_usd : null;
  if (p.match_confidence === 'none') return { ...base, reason: `No Form 990 match found for ${p.recipient}; size comparison not available.` };
  if (p.total_expenses === null) return { ...base, reason: `${p.matched_name}'s Form 990 on ProPublica has no expense total; size comparison not available (${p.match_confidence} confidence match).` };
  const fas = budget === null ? 'FAS budget not on file' : `FAS budget ${money(budget)} (${capacityBand(budget)})${budget > 0 ? `, about ${(p.total_expenses / budget).toFixed(1)}× FAS` : ''}`;
  return { ...base, reason: `Winner's latest expenses ${money(p.total_expenses)} (FY${p.latest_tax_year ?? '?'}, ${capacityBand(p.total_expenses)}) vs ${fas}; ${p.match_confidence} confidence match on ${p.matched_name}.` };
}
