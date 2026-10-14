import type { SupabaseClient } from '@supabase/supabase-js';
import { GAP_NO_GRANTEES, capacityBand, type CapacityBand } from '../../packages/ingest/propublica';
/** Stored `irs_990pf` award_history row as read under RLS (admin/staff SELECT). `raw` is the ProPublica filing object plus `ein`. */
export type StoredFoundationRow = { id: string; source: string; funder: string | null; fiscal_year: number | null; description: string | null; raw: Record<string, unknown> };
export type FunderSummary = { funder: string | null; ein: string | null; years: number; data_years: number[]; latest_year: number | null; latest_expenses: number | null; capacity_band: CapacityBand; reason: string; source_ref: string | null };
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`, expenses = (raw: Record<string, unknown>): number | null => { const n = Number(raw.totfuncexpns); return raw.totfuncexpns != null && Number.isFinite(n) ? n : null; };
/** "Who funds this" facts for one funder: filing years, latest expenses and band, with a one-sentence reason that names the data year and the grantee gap,
 * and a `source_ref` (`award_history:<id>` of the latest row) so F-508 drafts cite stored rows. Pure. */
export function funderSummary(rows: StoredFoundationRow[]): FunderSummary {
  const sorted = [...rows].filter((r) => r.source === 'irs_990pf').sort((a, b) => (b.fiscal_year ?? 0) - (a.fiscal_year ?? 0)), latest = sorted[0];
  const data_years = [...new Set(sorted.map((r) => r.fiscal_year).filter((y): y is number => typeof y === 'number'))], latest_expenses = latest ? expenses(latest.raw) : null;
  const ein = typeof latest?.raw.ein === 'string' ? latest.raw.ein : null, capacity_band = capacityBand(latest_expenses);
  const reason = latest ? `${latest.funder ?? 'Funder'} filed 990-PF for ${data_years.length} tax year(s) (${data_years.at(-1)}–${data_years[0]}); latest total expenses ${latest_expenses === null ? 'not reported' : usd(latest_expenses)} (${capacity_band} capacity). ${GAP_NO_GRANTEES}`
    : 'No 990-PF filing data stored for this funder.';
  return { funder: latest?.funder ?? null, ein, years: data_years.length, data_years, latest_year: data_years[0] ?? null, latest_expenses, capacity_band, reason, source_ref: latest ? `award_history:${latest.id}` : null };
}
/** Reads under the caller's RLS (admin/staff): stored 990-PF rows whose funder contains the name, newest first. */
export class FunderHistoryQuery {
  static readonly COLUMNS = 'id,source,funder,fiscal_year,description,raw';
  static async byFunderName(client: SupabaseClient, name: string): Promise<FunderSummary> {
    const { data, error } = await client.from('award_history').select(FunderHistoryQuery.COLUMNS).eq('source', 'irs_990pf').ilike('funder', `%${name.replace(/[%_]/g, '')}%`)
      .order('fiscal_year', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return funderSummary((data ?? []) as StoredFoundationRow[]);
  }
}
