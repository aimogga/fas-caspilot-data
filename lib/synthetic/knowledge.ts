// F-508b: obviously fictional org facts so local and preview have citable org_knowledge rows. Never real FAS text.
import type { Category } from '../knowledge/guard.ts';
import { SYNTH_ORG } from './generate.ts';

const kid = (n: number) => `f508b000-0000-4000-a000-${String(n).padStart(12, '0')}`;
export const KNOWLEDGE = [
  [1, 'mission', 'approved', 'Mission (fictional)', 'Synthetic seed', '2026-01-01',
    'Bluebird Family Fund is a fictional nonprofit used for testing. It pays licensed therapists so families who cannot afford counseling can start it quickly.'],
  [2, 'service_model', 'approved', 'How referrals work (fictional)', 'Synthetic seed', '2026-01-01',
    'Families are referred by community partners, apply once, and choose a therapist from a contracted network. Families pay on a sliding scale.'],
  [3, 'outcome', 'approved', 'Completion (fictional)', 'Synthetic annual report (not real)', '2025-12-31',
    'In this made-up example year, 7 in 10 families who started therapy completed at least 8 sessions.'],
  [4, 'boilerplate', 'draft', 'Closing paragraph (fictional draft)', null, null,
    'Draft text only: we would welcome the chance to discuss how this fictional program could grow with your support.'],
].map(([n, category, status, title, source, as_of, body]) => ({
  id: kid(n as number), org_id: SYNTH_ORG, category: category as Category, status: status as string, title: title as string,
  source: source as string | null, as_of: as_of as string | null, body: body as string, approved_by: status === 'approved' ? '11111111-1111-1111-1111-111111111111' : null,
}));

const lit = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`);
/** Idempotent: existing ids are left alone (rows are never deleted; the trigger writes version 1). */
export function knowledgeSql(): string {
  const vals = KNOWLEDGE.map((k) => `(${[k.id, k.org_id, k.category, k.title, k.body, k.source, k.as_of, k.status, k.approved_by].map(lit).join(',')})`);
  return `INSERT INTO org_knowledge (id,org_id,category,title,body,source,as_of,status,approved_by) VALUES\n${vals.join(',\n')}\nON CONFLICT (id) DO NOTHING;\n`;
}
