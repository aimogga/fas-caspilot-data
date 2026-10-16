// F-508b: citable reads and guarded writes for org_knowledge. RLS scopes every call to the caller's org and role.
// Citations name the exact version quoted, `org_knowledge:<id>@v<version>`, and resolve against the immutable org_knowledge_version.
import type { SupabaseClient } from '@supabase/supabase-js';
import { type Category, checkKnowledge, type GuardResult, type KnowledgeFields } from './guard';

export type Status = 'draft' | 'approved' | 'archived';
export type KnowledgeRow = { id: string; category: Category; title: string; body: string; source: string | null; as_of: string | null; version: number };
export type CitableRow = KnowledgeRow & { source_ref: string };
export type Write = { ok: true; row: CitableRow } | { ok: false; guard?: GuardResult; error?: string };
const COLS = 'id,category,title,body,source,as_of,version';
const REF = /^org_knowledge:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@v([1-9]\d{0,8})$/;

export const sourceRef = (id: string, version: number) => `org_knowledge:${id}@v${version}`;
export const parseSourceRef = (ref: string) => { const m = REF.exec(ref); return m ? { id: m[1]!, version: Number(m[2]) } : null; };
const cite = (r: KnowledgeRow): CitableRow => ({ ...r, source_ref: sourceRef(r.id, r.version) });

/** Approved rows the caller may see (admin or staff, own org), each with its versioned source_ref. */
export async function listApproved(client: SupabaseClient, opts: { categories?: Category[] } = {}): Promise<CitableRow[]> {
  let q = client.from('org_knowledge').select(COLS).eq('status', 'approved');
  if (opts.categories?.length) q = q.in('category', opts.categories);
  const { data, error } = await q.order('category').order('title');
  if (error) throw new Error(error.message);
  return ((data ?? []) as KnowledgeRow[]).map(cite);
}

/** The exact text a citation quoted, or null when the ref is malformed, unknown, not visible, or that version was not approved. */
export async function resolveCitation(client: SupabaseClient, ref: string): Promise<CitableRow | null> {
  const p = parseSourceRef(ref);
  if (!p) return null;
  const { data, error } = await client.from('org_knowledge_version').select('knowledge_id,category,title,body,source,as_of,version')
    .eq('knowledge_id', p.id).eq('version', p.version).eq('status', 'approved').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { knowledge_id, ...rest } = data as Omit<KnowledgeRow, 'id'> & { knowledge_id: string };
  return cite({ id: knowledge_id, ...rest });
}

type Fields = KnowledgeFields & { status?: Status };
/** The only app write path: the guard runs server-side first, then RLS requires an admin of the org. `{ orgId }` inserts, `{ id }` edits
 *  (the trigger bumps the version and keeps the old text); archive with status 'archived', there is no delete. */
export async function saveKnowledge(client: SupabaseClient, target: { orgId: string } | { id: string }, f: Fields): Promise<Write> {
  const guard = checkKnowledge(f);
  if (!guard.ok) return { ok: false, guard };
  const t = client.from('org_knowledge');
  const q = 'id' in target ? t.update(f).eq('id', target.id) : t.insert({ org_id: target.orgId, ...f });
  const { data, error } = await q.select(COLS).maybeSingle();
  if (error) return { ok: false, error: 'Not saved: the database refused the row.' };
  return data ? { ok: true, row: cite(data as KnowledgeRow) } : { ok: false, error: 'Not saved: row not found or not editable.' };
}
