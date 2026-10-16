// F-508c: words, grouping, form parsing and the list loader for the FAS knowledge screens. RLS decides what each role reads.
import type { SupabaseClient } from '@supabase/supabase-js';
import { CATEGORIES, type Category, checkKnowledge, checkKnowledgeText, type GuardResult, type KnowledgeFields } from './guard';
import type { KnowledgeRow, Status } from './store';

export const STATUSES = ['draft', 'approved', 'archived'] as const satisfies readonly Status[];
export const CATEGORY_LABEL: Record<Category, string> = { mission: 'Mission', program: 'Programs', service_model: 'How services work', staffing: 'Staffing', budget: 'Budget',
  eligibility: 'Eligibility facts', outcome: 'Outcomes', boilerplate: 'Standard paragraphs', other: 'Other' };
export const STATUS_WORDS: Record<Status, { label: string; hint: string }> = {
  draft: { label: 'Draft', hint: 'Draft: not yet approved, so the grant writer cannot quote it.' },
  approved: { label: 'Approved', hint: 'Approved: the grant writer may quote this text and cite this version.' },
  archived: { label: 'Archived', hint: 'Archived: kept for the record and old citations, never quoted again.' },
};
export const CONFIRM_LABEL = 'This text contains no client or family information.';

export type Version = { knowledge_id: string; version: number; status: Status; title: string; body: string; edited_by: string | null; recorded_at: string };
export type ListRow = KnowledgeRow & { status: Status; updated_at: string; history: Version[] };
export type Filters = { category: Category | 'all'; status: Status | 'all' };

const isCategory = (v: unknown): v is Category => (CATEGORIES as readonly unknown[]).includes(v);
const isStatus = (v: unknown): v is Status => (STATUSES as readonly unknown[]).includes(v);
export const parseFilters = (q: Record<string, string | string[] | undefined>): Filters => ({
  category: isCategory(q.category) ? q.category : 'all', status: isStatus(q.status) ? q.status : 'all',
});
export const applyFilters = (rows: ListRow[], f: Filters) =>
  rows.filter((r) => (f.category === 'all' || r.category === f.category) && (f.status === 'all' || r.status === f.status));

/** Categories in the fixed CATEGORIES order, empty ones dropped. */
export const groupByCategory = (rows: ListRow[]) =>
  CATEGORIES.map((c) => ({ category: c, label: CATEGORY_LABEL[c], rows: rows.filter((r) => r.category === c) })).filter((g) => g.rows.length);

/** "Jan 2026": org facts are dated to the month, like every shared view. */
export const monthYear = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;
export const editorWords = (by: string | null, me: string | null) => (!by ? 'the setup import' : by === me ? 'you' : 'another admin');

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
export type Parsed = { ok: true; id: string | null; fields: KnowledgeFields } | { ok: false; message: string };
/** Form → fields. The privacy checkbox is required; the guard runs on title, body and source, and names the rule, never the text. */
export function parseForm(f: FormData): Parsed {
  if (f.get('confirm') !== 'yes') return { ok: false, message: `Not saved: tick "${CONFIRM_LABEL}"` };
  const category = text(f, 'category');
  if (!isCategory(category)) return { ok: false, message: 'Not saved: choose a category.' };
  const fields: KnowledgeFields = { category, title: text(f, 'title'), body: text(f, 'body'), source: text(f, 'source') || null, as_of: text(f, 'as_of') || null };
  const source = fields.source ? checkKnowledgeText(fields.source) : ({ ok: true } as GuardResult);
  if (!source.ok) return { ok: false, message: source.message.replace('the text', 'the source') };
  const guard = checkKnowledge(fields);
  return guard.ok ? { ok: true, id: text(f, 'id') || null, fields } : { ok: false, message: guard.message };
}

/** Every row the caller may read, newest version history first. Admin sees all statuses; staff see approved rows and versions only. */
export async function loadKnowledge(client: SupabaseClient): Promise<ListRow[]> {
  const [rows, versions] = await Promise.all([
    client.from('org_knowledge').select('id,category,title,body,source,as_of,version,status,updated_at').order('title'),
    client.from('org_knowledge_version').select('knowledge_id,version,status,title,body,edited_by,recorded_at').order('version', { ascending: false }),
  ]);
  if (rows.error || versions.error) throw new Error((rows.error ?? versions.error)!.message);
  const history = (versions.data ?? []) as Version[];
  return ((rows.data ?? []) as Omit<ListRow, 'history'>[]).map((r) => ({ ...r, history: history.filter((v) => v.knowledge_id === r.id) }));
}
