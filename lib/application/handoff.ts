import type { SupabaseClient } from '@supabase/supabase-js';
import type { generateJson } from '../llm';
import { ApplicationError, createApplicationDraft } from './generate';
import type { ApplicationDraftRow } from './query';

/** F-508j: the strategy → application hand-off and the download audit (privacy rule 8). Both run under the caller's RLS. */
export type StartResult = { id: string; opened: boolean } | { error: string };
export type DraftLink = { id: string; status: ApplicationDraftRow['status']; created_at: string };

/** The strategy's application drafts, newest first. */
export async function draftsFor(client: SupabaseClient, strategyId: string): Promise<DraftLink[]> {
  const { data, error } = await client.from('application_draft').select('id,status,created_at').eq('strategy_draft_id', strategyId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DraftLink[];
}

/** Opens the newest draft for this strategy when one exists (never a duplicate), otherwise writes one. A refusal (not approved, quota) comes back as plain words. */
export async function startOrOpen(client: SupabaseClient, strategyId: string, generate?: typeof generateJson): Promise<StartResult> {
  const newest = (await draftsFor(client, strategyId))[0];
  if (newest) return { id: newest.id, opened: true };
  try {
    const r = await createApplicationDraft(client, strategyId, generate);
    return 'error' in r ? r : { id: r.id, opened: false };
  } catch (e) {
    if (e instanceof ApplicationError) return { error: e.message };
    throw e;
  }
}

export const DOWNLOAD_TYPE = 'application-docx', DOWNLOAD_ACTION = 'application.download';
/** One `export_job` and one `audit_log` per approved application download, as the packet export does. */
export async function recordDownload(client: SupabaseClient, d: Pick<ApplicationDraftRow, 'id' | 'org_id' | 'strategy_draft_id'>, userId: string): Promise<void> {
  const params = { application_id: d.id, strategy_draft_id: d.strategy_draft_id, status: 'downloaded' };
  const job = await client.from('export_job').insert({ org_id: d.org_id, type: DOWNLOAD_TYPE, params, suppression_applied: true, created_by: userId }).select('id').single();
  if (job.error) throw new Error(job.error.message);
  const audit = await client.from('audit_log').insert({ org_id: d.org_id, actor: userId, action: DOWNLOAD_ACTION, entity: 'export_job', entity_id: job.data.id, details: params });
  if (audit.error) throw new Error(audit.error.message);
}
