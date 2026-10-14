import { auditRow, PARENT_TABLE, rowForInsert } from './entry';
import { INTAKE_ENTITIES, INTAKE_SCHEMA, isIntakeEntity } from './schema';
import { validateRows } from './validate';

type Rows = PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
type One = PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
type Ins = PromiseLike<{ error: { message: string } | null }> & { select(cols: string): { single(): One } };
/** The slice of a Supabase client the handler uses, so tests can pass a fake. RLS scopes every call to the caller's org. */
export type EntryDb = { from(table: string): { select(cols: string): { eq(col: string, v: string): Rows }; insert(row: Record<string, unknown>): Ins } };
export type EntryUser = { id: string; role: string; orgId: string | null } | null;
const UUIDISH = /^[0-9a-f-]{36}$/i;
const fail = (status: number, error: string) => Response.json({ error }, { status });

/** POST /api/intake/entry `{ entity, row }` → 201 `{ id }`. Re-validates with the upload validator, inserts one row, then an audit_log row. */
export class EntryHttp {
  static async handle(request: Request, user: EntryUser, db: EntryDb | null): Promise<Response> {
    if (user == null) return fail(401, 'Sign in required');
    if (user.role !== 'admin' && user.role !== 'staff') return fail(403, 'Admin or staff role required');
    const body = (await request.json().catch(() => null)) as { entity?: unknown; row?: unknown } | null;
    const entity = typeof body?.entity === 'string' ? body.entity : '';
    const row = body?.row;
    if (!isIntakeEntity(entity)) return fail(400, `Unknown entity "${entity}". Use one of: ${INTAKE_ENTITIES.join(', ')}`);
    if (!row || typeof row !== 'object' || Array.isArray(row)) return fail(400, 'Body must be { entity, row }');
    if (!user.orgId) return fail(403, 'Your account is not linked to an organization');
    if (!db) return fail(503, 'Database unavailable');
    const raw = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)]));
    const counties = await db.from('geo_county').select('fips').eq('state', 'UT');
    if (counties.error || !counties.data) return fail(500, "Couldn't load the county list");
    const knownIds = new Set<string>();
    for (const f of INTAKE_SCHEMA[entity].fields) {
      const v = (raw[f.key] ?? '').trim().toLowerCase();
      if (f.type !== 'uuid_ref' || !UUIDISH.test(v) || !PARENT_TABLE[f.key]) continue;
      for (const r of (await db.from(PARENT_TABLE[f.key]).select('id').eq('id', v)).data ?? []) knownIds.add(String(r.id));
    }
    const { ok, errors } = validateRows(entity, [raw], { countyFips: new Set(counties.data.map((r) => String(r.fips))), knownIds });
    if (errors.length) return Response.json({ errors }, { status: 422 });
    const ins = await db.from(INTAKE_SCHEMA[entity].table).insert(rowForInsert(entity, ok[0].values, user.orgId)).select('id').single();
    if (ins.error || !ins.data) return fail(500, "Couldn't save the record. Nothing was stored; try again.");
    const id = String(ins.data.id);
    // No RETURNING here: audit_log is readable by admins only, so a staff insert that also selects is rejected by RLS.
    const audit = await db.from('audit_log').insert(auditRow(entity, id, user.orgId, user.id));
    if (audit.error) return Response.json({ error: 'The record was saved but its audit entry failed. Tell an admin.', id }, { status: 500 });
    return Response.json({ id }, { status: 201 });
  }
}
