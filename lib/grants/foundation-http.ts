import type { SupabaseClient } from '@supabase/supabase-js';
import { FOUNDATION_TEMPLATE_CSV, importReport, MAX_CSV_ROWS } from './foundation-csv';
import { type FoundationInput, PIPELINE_NEW_STATUS, toOpportunityRow, validateFoundation } from './foundation';

type Auth = { client: SupabaseClient; user: { id: string; org_id: string } };
type Body = { mode?: string; row?: FoundationInput; rows?: FoundationInput[] };
const json = (body: unknown, status: number) => Response.json(body, { status });
const fail = (error: { code?: string } | null, table: string): Response => {
  console.error('[grants/foundation] insert failed', { table, code: error?.code });
  return error?.code === '23505' ? json({ error: 'An opportunity with the same funder, title and close date already exists' }, 409) : json({ error: `Could not save to ${table}` }, 500);
};

/** POST /api/grants/foundation (`{mode:'manual',row}` or `{mode:'csv',rows}`) and GET …/template. Admin or staff; fails closed; RLS-enforced. */
export class FoundationHttp {
  static async auth(client: SupabaseClient | null): Promise<Auth | Response> {
    if (!client) return json({ error: 'Database not configured' }, 503);
    const user = (await client.auth.getUser()).data.user, { role, org_id } = (user?.app_metadata ?? {}) as { role?: string; org_id?: string };
    if (!user) return json({ error: 'Sign in required' }, 401);
    if (role !== 'admin' && role !== 'staff') return json({ error: 'Admin or staff role required' }, 403);
    return org_id ? { client, user: { id: user.id, org_id } } : json({ error: 'Account has no organisation' }, 403);
  }

  static template = () => new Response(FOUNDATION_TEMPLATE_CSV, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="fas-foundation-template.csv"' } });

  static async post(request: Request, client: SupabaseClient | null, now = new Date()): Promise<Response> {
    const auth = await FoundationHttp.auth(client);
    if (auth instanceof Response) return auth;
    const body: Body | null = await request.json().catch(() => null), manual = body?.mode === 'manual' && !!body.row && typeof body.row === 'object', csv = body?.mode === 'csv' && Array.isArray(body.rows);
    if (!manual && !csv) return json({ error: 'Send { mode: "manual", row } or { mode: "csv", rows }' }, 400);
    if (csv && body!.rows!.length > MAX_CSV_ROWS) return json({ error: `At most ${MAX_CSV_ROWS} rows per import` }, 413);
    const source = manual ? 'foundation_manual' : 'foundation_csv', v = manual ? validateFoundation(body!.row!) : null;
    const valid = v ? { ok: v.ok ? [v.ok] : [], errors: v.errors } : importReport(body!.rows!.map((input, i) => ({ row: i + 2, input: input ?? {} })));
    if (valid.errors.length) return json({ error: 'Some rows have errors', errors: valid.errors }, 422); else if (!valid.ok.length) return json({ error: 'Nothing to import' }, 422);
    const { client: db, user } = auth;
    const ins = await db.from('opportunity').insert(valid.ok.map((row) => toOpportunityRow(row, source, now))).select('id,title');
    if (ins.error || !ins.data) return fail(ins.error, 'opportunity');
    const ids = ins.data.map((r) => r.id as string), pipe = await db.from('pipeline_status').insert(ids.map((opportunity_id) => ({ opportunity_id, org_id: user.org_id, status: PIPELINE_NEW_STATUS })));
    if (pipe.error) return fail(pipe.error, 'pipeline_status');
    const action = manual ? 'grants.foundation.manual' : 'grants.foundation.csv', details = { count: ids.length, source, ...(manual ? {} : { opportunity_ids: ids }) };
    const audit = await db.from('audit_log').insert({ org_id: user.org_id, actor: user.id, action, entity: 'opportunity', entity_id: manual ? ids[0] : null, details });
    return audit.error ? fail(audit.error, 'audit_log') : json({ inserted: ids.length, titles: ins.data.map((r) => r.title as string) }, 201);
  }
}
