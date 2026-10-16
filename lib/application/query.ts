import type { SupabaseClient } from '@supabase/supabase-js';
import type { Snapshot } from '../strategy/snapshot';
import type { Section } from './generate';

export type ApplicationDraftRow = {
  id: string; org_id: string; opportunity_id: string; strategy_draft_id: string; status: 'DRAFT' | 'approved' | 'archived'; sections: Section[]; approved_at: string | null; created_at: string;
};
export type LoadedApplication = { draft: ApplicationDraftRow; snapshot: Snapshot; title: string };

/** One draft, its strategy's stored snapshot (the only facts it may cite) and the opportunity title, under the caller's RLS. Null when not visible. */
export async function loadApplication(client: SupabaseClient, id: string): Promise<LoadedApplication | null> {
  const d = await client.from('application_draft').select('id,org_id,opportunity_id,strategy_draft_id,status,sections,approved_at,created_at').eq('id', id).maybeSingle();
  if (d.error) throw new Error(d.error.message);
  if (!d.data) return null;
  const draft = d.data as ApplicationDraftRow;
  const [s, o] = await Promise.all([
    client.from('strategy_draft').select('snapshot').eq('id', draft.strategy_draft_id).single(),
    client.from('opportunity').select('title,funder').eq('id', draft.opportunity_id).maybeSingle(),
  ]);
  if (s.error) throw new Error(s.error.message);
  const snap = (s.data?.snapshot ?? {}) as Partial<Snapshot>;
  const snapshot: Snapshot = { opportunity_id: snap.opportunity_id ?? draft.opportunity_id, built_at: snap.built_at ?? '', facts: snap.facts ?? [], abstracts: snap.abstracts ?? [] };
  const title = o.data ? `${o.data.title}${o.data.funder ? ` · ${o.data.funder}` : ''}` : 'Grant application';
  return { draft: { ...draft, sections: Array.isArray(draft.sections) ? draft.sections : [] }, snapshot, title };
}
