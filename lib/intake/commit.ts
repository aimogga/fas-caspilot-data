import type { Mapping } from './mapping';
import { INTAKE_SCHEMA, type IntakeEntity } from './schema';
import type { Cell, ValidRow } from './validate';

/** F-301 part 3: pure helpers between the validated preview and the `intake_commit` database function. */
export const MAX_COMMIT_ROWS = 5000, MAX_COMMIT_BYTES = 2 * 1024 * 1024;
export type DbRow = Record<string, Cell | string[]>;
export type CommitPayload = { entity: IntakeEntity; mapping: Mapping; rows: DbRow[] };
/** Reference column → parent table, from the schema's `uuid_ref` fields (`case_id` → `case`, `provider_id` → `provider`). */
export const parentKeyFor = (entity: IntakeEntity): Record<string, string> =>
  Object.fromEntries(INTAKE_SCHEMA[entity].fields.filter((f) => f.type === 'uuid_ref').map((f) => [f.key, f.key.replace(/_id$/, '')]));
/** Coerced values → database columns. A blank id is dropped so Postgres assigns one; `prior_services` becomes the jsonb list the schema stores. */
export function rowsForInsert(entity: IntakeEntity, valid: ValidRow[]): DbRow[] {
  return valid.map(({ values }) => {
    const row: DbRow = { ...values };
    if (row.id == null) delete row.id;
    if (entity === 'case') row.prior_services = String(values.prior_services ?? '').split(';').map((s) => s.trim()).filter(Boolean);
    return row;
  });
}
/** Arguments for `intake_commit(entity, mapping, rows)`; `org_id` and `upload_batch_id` are stamped by the database, never by the client. */
export const buildBatchPayload = (entity: IntakeEntity, mapping: Mapping, valid: ValidRow[]): CommitPayload => ({ entity, mapping, rows: rowsForInsert(entity, valid) });
export const shortId = (id: string) => id.slice(0, 8), savedText = (n: number, id: string) => `Saved ${n} ${n === 1 ? 'row' : 'rows'} as batch ${shortId(id)}`;
/** Browser side of both routes: JSON in, `{ data }` or a plain-English `{ error }` out; never throws. */
export async function postJson(path: string, body: unknown): Promise<{ data: Record<string, unknown>; error: null } | { data: null; error: string }> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return res.ok ? { data, error: null } : { data: null, error: typeof data.error === 'string' ? data.error : `Request failed (${res.status})` };
  } catch { return { data: null, error: 'Could not reach the server. Check your connection and try again.' }; }
}
