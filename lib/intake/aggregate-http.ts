import { auditRow, rowForInsert, validateAggregate, type AggregateInput } from './aggregate';
import type { EntryDb, EntryUser } from './entry-http';

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** POST /api/intake/aggregate `{ period, metric, value, county_fips?, note? }` → 201 `{ id }`. Same auth as `/api/intake/entry`; RLS scopes the org. */
export class AggregateHttp {
  static async handle(request: Request, user: EntryUser, db: EntryDb | null): Promise<Response> {
    if (user == null) return fail(401, 'Sign in required');
    if (user.role !== 'admin' && user.role !== 'staff') return fail(403, 'Admin or staff role required');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'Body must be { period, metric, value, county_fips?, note? }');
    if (!user.orgId) return fail(403, 'Your account is not linked to an organization');
    if (!db) return fail(503, 'Database unavailable');
    const input = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v == null ? '' : String(v)])) as Partial<AggregateInput>;
    const counties = await db.from('geo_county').select('fips').eq('state', 'UT');
    if (counties.error || !counties.data) return fail(500, "Couldn't load the county list");
    const v = validateAggregate(input, { countyFips: new Set(counties.data.map((r) => String(r.fips))) });
    if ('errors' in v) return Response.json({ errors: v.errors }, { status: 422 });
    const ins = await db.from('aggregate_submission').insert(rowForInsert(v.ok, user.orgId, user.id)).select('id').single();
    if (ins.error || !ins.data) return fail(500, "Couldn't save the total. Nothing was stored; try again.");
    const id = String(ins.data.id);
    // No RETURNING here: audit_log is readable by admins only, so a staff insert that also selects is rejected by RLS.
    const audit = await db.from('audit_log').insert(auditRow(id, user.orgId, user.id, v.ok.metric_code));
    if (audit.error) return Response.json({ error: 'The total was saved but its audit entry failed. Tell an admin.', id }, { status: 500 });
    return Response.json({ id }, { status: 201 });
  }
}
