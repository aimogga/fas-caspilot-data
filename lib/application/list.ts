import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationDraftRow } from './query';

/** F-508k: every application draft the caller can see (RLS), newest first, with its grant's title and funder. */
export type ApplicationListItem = { id: string; status: ApplicationDraftRow['status']; title: string; funder: string | null; started: string; approved: string | null };
type Row = Pick<ApplicationDraftRow, 'id' | 'opportunity_id' | 'status' | 'approved_at' | 'created_at'>;

export const LIST_LIMIT = 200;
export const STATUS_WORDS: Record<ApplicationDraftRow['status'], string> = { DRAFT: 'Draft, open for edits', approved: 'Approved', archived: 'Archived' };
/** Month and year only, in UTC (dates on shared screens stay at month level). */
export const monthOf = (iso: string): string => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export async function listApplications(client: SupabaseClient): Promise<ApplicationListItem[]> {
  const d = await client.from('application_draft').select('id,opportunity_id,status,approved_at,created_at').order('created_at', { ascending: false }).limit(LIST_LIMIT);
  if (d.error) throw new Error(d.error.message);
  const rows = (d.data ?? []) as Row[], ids = [...new Set(rows.map((r) => r.opportunity_id))];
  const o = ids.length ? await client.from('opportunity').select('id,title,funder').in('id', ids) : { data: [], error: null };
  if (o.error) throw new Error(o.error.message);
  const opps = new Map(((o.data ?? []) as { id: string; title: string; funder: string | null }[]).map((x) => [x.id, x]));
  return rows.map((r) => {
    const opp = opps.get(r.opportunity_id);
    return { id: r.id, status: r.status, title: opp?.title ?? 'Grant application', funder: opp?.funder ?? null, started: monthOf(r.created_at), approved: r.approved_at ? monthOf(r.approved_at) : null };
  });
}

/** "2 drafts · 1 approved · 1 archived": the count line above the table. */
export function countWords(items: Pick<ApplicationListItem, 'status'>[]): string {
  const n = (s: ApplicationListItem['status']) => items.filter((i) => i.status === s).length, d = n('DRAFT');
  return `${d} ${d === 1 ? 'draft' : 'drafts'} · ${n('approved')} approved · ${n('archived')} archived`;
}
