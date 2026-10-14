import type { SupabaseClient } from '@supabase/supabase-js';
/** Stored award_history row as read under RLS (admin/staff SELECT). */
export type StoredAward = { id: string; source: string; funder: string | null; recipient: string; recipient_state: string | null; recipient_type: string | null;
  amount: number | null; fiscal_year: number | null; assistance_listing: string | null; description: string | null };
export type OpportunityLike = { assistance_listing: string | null; funder: string | null; title: string | null; description: string | null };
export type SimilarAward = StoredAward & { score: number; reason: string; source_ref: string };
export type AwardSummary = { count: number; median: number | null; min: number | null; max: number | null; utah_share: number | null; recipient_types: Record<string, number> };
const STOP = new Set(['with', 'from', 'that', 'this', 'their', 'services', 'program', 'grant', 'grants', 'project', 'projects', 'funding', 'support', 'supports']);
/** Distinct lower-case words of 4+ letters, minus boilerplate; the overlap basis for "shares the terms". */
export const keywords = (...texts: (string | null | undefined)[]): Set<string> => new Set(texts.join(' ').toLowerCase().match(/[a-z][a-z-]{3,}/g)?.filter((w) => !STOP.has(w)) ?? []);
const sameFunder = (a: string | null, b: string | null) => !!a && !!b && (a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase()));
const usd = (n: number | null) => `$${Math.round(n ?? 0).toLocaleString('en-US')}`;
/** Ranks stored awards for one opportunity: same Assistance Listing (3) > same funder (2) > shared description terms (1 each, max 3); ties by amount desc.
 * Every row carries a one-sentence `reason` and a `source_ref` (`award_history:<id>`) so panels and drafts cite it without recomputing. Pure. */
export function similarAwards(rows: StoredAward[], opp: OpportunityLike, n = 5): SimilarAward[] {
  const want = keywords(opp.title, opp.description);
  return rows.map((r) => {
    const aln = !!r.assistance_listing && r.assistance_listing === opp.assistance_listing, funder = sameFunder(r.funder, opp.funder);
    const shared = [...keywords(r.description)].filter((w) => want.has(w)).sort().slice(0, 3);
    const why = [aln && `same Assistance Listing ${r.assistance_listing}`, funder && 'same funder', shared.length && `shares the terms ${shared.join(', ')}`].filter(Boolean);
    const reason = why.length ? `${r.recipient} won ${usd(r.amount)} in FY${r.fiscal_year ?? '?'}: ${why.join('; ')}.` : 'No match on listing, funder or terms.';
    return { ...r, score: (aln ? 3 : 0) + (funder ? 2 : 0) + shared.length, reason, source_ref: `award_history:${r.id}` };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score || (b.amount ?? 0) - (a.amount ?? 0)).slice(0, n);
}
/** Same statistics as the SQL `award_history_summary` (count, median, range, recipient types, Utah share), for fixtures and golden tests. Pure. */
export function summarize(rows: StoredAward[]): AwardSummary {
  const a = rows.map((r) => r.amount).filter((x): x is number => typeof x === 'number').sort((x, y) => x - y), mid = a.length / 2;
  const recipient_types: Record<string, number> = {};
  for (const r of rows) recipient_types[r.recipient_type ?? 'unknown'] = (recipient_types[r.recipient_type ?? 'unknown'] ?? 0) + 1;
  return { count: rows.length, median: a.length ? (a.length % 2 ? a[Math.floor(mid)] : (a[mid - 1] + a[mid]) / 2) : null, min: a[0] ?? null, max: a.at(-1) ?? null, recipient_types,
    utah_share: rows.length ? Math.round((rows.filter((r) => r.recipient_state === 'UT').length / rows.length) * 1000) / 1000 : null };
}
/** Reads under the caller's RLS (admin/staff): the opportunity, then awards on its Assistance Listing (or its funder when it has none), ranked and summarised. */
export class AwardHistoryQuery {
  static readonly COLUMNS = 'id,source,funder,recipient,recipient_state,recipient_type,amount,fiscal_year,assistance_listing,description';
  static async forOpportunity(client: SupabaseClient, opportunityId: string, n = 5): Promise<{ opportunity: OpportunityLike; similar: SimilarAward[]; summary: AwardSummary }> {
    const opp = await client.from('opportunity').select('assistance_listing,funder,title,description').eq('id', opportunityId).single();
    if (opp.error || !opp.data) throw new Error(opp.error?.message || 'opportunity not found');
    const o = opp.data as OpportunityLike, q = client.from('award_history').select(AwardHistoryQuery.COLUMNS).order('amount', { ascending: false }).limit(500);
    const { data, error } = await (o.assistance_listing ? q.eq('assistance_listing', o.assistance_listing) : q.ilike('funder', `%${(o.funder ?? '').replace(/[%_]/g, '')}%`));
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((r) => ({ ...r, amount: r.amount === null ? null : Number(r.amount) })) as StoredAward[];
    return { opportunity: o, similar: similarAwards(rows, o, n), summary: summarize(rows) };
  }
}
