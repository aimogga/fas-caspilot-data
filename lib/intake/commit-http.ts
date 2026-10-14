import type { SupabaseClient } from '@supabase/supabase-js';
import { buildBatchPayload, MAX_COMMIT_BYTES, MAX_COMMIT_ROWS, parentKeyFor, type CommitPayload } from './commit';
import { applyMapping, type Mapping } from './mapping';
import { isIntakeEntity, type IntakeEntity } from './schema';
import { validateRows } from './validate';

/** What the handlers need from the database; `supabaseIntakeDb` adapts a signed-in client so RLS decides what each call sees. */
export type DbError = { code?: string; message: string } | null;
export type IntakeDb = {
  countyFips(): Promise<string[]>;
  knownIds(table: string, candidates: string[]): Promise<string[]>;
  commit(payload: CommitPayload): Promise<{ data: string | null; error: DbError }>;
  rollback(batchId: string): Promise<{ error: DbError }>;
};
type CommitBody = { entity: IntakeEntity; mapping: Mapping; headers: string[]; rows: string[][] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, json = (status: number, body: unknown) => Response.json(body, { status });
/** Postgres SQLSTATE → HTTP: RLS/role 42501 → 403, no batch P0002 → 404, already rolled back 55000 or later rows reference these 23503 → 409. */
export const dbStatus = (e: NonNullable<DbError>) => ({ '42501': 403, P0002: 404, '55000': 409, '23503': 409 })[e.code ?? ''] ?? 500;

/** Role gate + JSON body (2 MB cap) shared by both routes; a Response means the request stops here. */
async function accept<T>(request: Request, role: string | null | undefined): Promise<T | Response> {
  if (role == null) return json(401, { error: 'Sign in required' });
  if (role !== 'admin' && role !== 'staff') return json(403, { error: 'Admin or staff role required' });
  const text = await request.text();
  if (text.length > MAX_COMMIT_BYTES) return json(413, { error: 'Upload is over 2 MB. Split the file and upload the parts one at a time.' });
  try { return JSON.parse(text) as T; } catch { return json(400, { error: 'Body must be JSON' }); }
}
/** POST /api/intake/commit — re-validates on the server, then writes batch + rows + audit row atomically through `intake_commit`. */
export class CommitHttp {
  static async handle(request: Request, role: string | null | undefined, db: IntakeDb): Promise<Response> {
    const body = await accept<Partial<CommitBody>>(request, role);
    if (body instanceof Response) return body;
    const { entity, mapping, headers, rows } = body;
    if (!entity || !isIntakeEntity(entity) || !mapping || !Array.isArray(headers) || !Array.isArray(rows) || !rows.length) return json(400, { error: 'Expected entity, mapping, headers and at least one row' });
    if (rows.length > MAX_COMMIT_ROWS) return json(413, { error: `Uploads are limited to ${MAX_COMMIT_ROWS} rows at a time; this file has ${rows.length}.` });
    const records = applyMapping(headers, rows, mapping), knownIds: Record<string, Set<string>> = {};
    for (const [column, table] of Object.entries(parentKeyFor(entity))) {
      const wanted = [...new Set(records.map((r) => r[column]?.trim().toLowerCase()).filter((v): v is string => !!v && UUID.test(v)))];
      knownIds[column] = new Set(wanted.length ? await db.knownIds(table, wanted) : []);
    }
    const result = validateRows(entity, records, { countyFips: new Set(await db.countyFips()), knownIds });
    if (result.errors.length) return json(422, { error: `${result.errors.length} cell(s) failed validation; nothing was saved.`, errors: result.errors });
    const { data, error } = await db.commit(buildBatchPayload(entity, mapping, result.ok));
    return data ? json(200, { batchId: data, rows: result.ok.length }) : json(error ? dbStatus(error) : 500, { error: error?.message ?? 'Commit returned no batch id' });
  }
}
/** POST /api/intake/rollback — `intake_rollback` deletes the batch's rows, marks it rolled back and writes the audit row. */
export class RollbackHttp {
  static async handle(request: Request, role: string | null | undefined, db: IntakeDb): Promise<Response> {
    const body = await accept<{ batchId?: unknown }>(request, role);
    if (body instanceof Response) return body;
    if (typeof body.batchId !== 'string' || !UUID.test(body.batchId)) return json(400, { error: 'batchId must be a UUID' });
    const { error } = await db.rollback(body.batchId);
    return error ? json(dbStatus(error), { error: error.message }) : json(200, { ok: true, batchId: body.batchId });
  }
}
const rows = async <T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>) => { const r = await q; if (r.error) throw new Error(r.error.message); return r.data as T[]; };
const chunks = (xs: string[]) => Array.from({ length: Math.ceil(xs.length / 500) }, (_, i) => xs.slice(i * 500, i * 500 + 500));
export const supabaseIntakeDb = (client: SupabaseClient): IntakeDb => ({
  countyFips: async () => (await rows<{ fips: string }>(client.from('geo_county').select('fips').eq('state', 'UT'))).map((r) => r.fips),
  knownIds: async (table, c) => (await Promise.all(chunks(c).map((ids) => rows<{ id: string }>(client.from(table).select('id').in('id', ids))))).flat().map((r) => r.id),
  commit: async (p) => client.rpc('intake_commit', { entity: p.entity, mapping: p.mapping, rows: p.rows }),
  rollback: async (batchId) => client.rpc('intake_rollback', { batch_id: batchId }),
});
/** Route body for both POST handlers; `createClient` is injected so this module stays free of next/headers and unit-testable. */
export const intakeRoute = (H: typeof CommitHttp | typeof RollbackHttp, createClient: () => Promise<SupabaseClient | null>) => async (request: Request) => {
  const client = await createClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  if (!client || !user) return json(401, { error: 'Sign in required' });
  return H.handle(request, (user.app_metadata?.role as string | undefined) ?? '', supabaseIntakeDb(client));
};
