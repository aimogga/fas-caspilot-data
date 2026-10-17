/** F-403 packet data: the board's quarter and suppression (`MetricsQuery` with an optional county filter), the need map and methodology for the
 * profile and sources, and FAS service counties (county names only). A staff/admin render also writes an `export_job` + `audit_log` row. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { boardAsOf, boardFilters } from '../board/query';
import { aggregateTotals, AggregatesQuery } from '../dashboard/aggregates';
import { ALL } from '../dashboard/filters';
import { MetricsQuery } from '../dashboard/metrics-query';
import { MethodologyQuery } from '../methodology/query';
import { NeedMapQuery } from '../need-map/query';
import { COUNTIES } from '../synthetic/generate';
import { buildPacket, countyName, type Packet, type PacketScope, type PacketVariant } from './model';

/** `exportType` names the `export_job.type` a file export writes (`packet-docx`, `packet-csv`); a page render keeps the default. */
export type Actor = { userId: string; orgId: string; exportType?: string };
export const EXPORT_TYPE = 'packet-html', AUDIT_ACTION = 'packet.render';
const warn = (step: string) => (e: unknown) => { console.error(`[packets] ${step} failed`, { message: e instanceof Error ? e.message : 'unknown' }); return null; };
/** `?variant=` and `?county=` → a safe variant and scope (unknown values fall back to grant / statewide). */
export function parsePacketParams(params: Record<string, string | string[] | undefined>): { variant: PacketVariant; scope: PacketScope } {
  const one = (k: string) => ([] as string[]).concat(params[k] ?? [])[0];
  const county = one('county');
  return { variant: one('variant') === 'board' ? 'board' : 'grant', scope: county && countyName(county) ? { county } : {} };
}
export const PacketQuery = {
  async load(client: SupabaseClient, variant: PacketVariant, scope: PacketScope, now: Date, actor: Actor | null = null, env = process.env.NEXT_PUBLIC_ENV): Promise<Packet> {
    const f = { ...boardFilters(now), county: variant === 'grant' && scope.county ? scope.county : ALL };
    const [metrics, need, method, cases, aggRows] = await Promise.all([
      MetricsQuery.load(client, f), NeedMapQuery.load(client).catch(warn('need map')), MethodologyQuery.load(client, env).catch(warn('methodology')),
      client.from('case').select('county_fips').then((r) => (r.error ? warn('service counties')(new Error(r.error.message)) : (r.data as { county_fips: string | null }[])), warn('service counties')),
      AggregatesQuery.load(client, f.period).catch(warn('aggregate totals')), // F-303c: RLS limits these to admin and staff; a board reader gets none
    ]);
    const fips = [...new Set((cases ?? []).map((c) => c.county_fips).filter((x): x is string => !!x))];
    const serviceCounties = COUNTIES.filter((c) => fips.includes(c.fips)).map((c) => c.name);
    const packet = buildPacket({ variant, scope: f.county === ALL ? {} : scope, now, period: f.period, asOf: boardAsOf(metrics), metrics, need, method, serviceCounties, aggregates: aggRows ? aggregateTotals(aggRows, f.county) : null });
    if (actor) await PacketQuery.record(client, packet, actor).catch(warn('export_job'));
    return packet;
  },
  /** One `export_job` (type `packet-html`, suppression applied) and one `audit_log` (`packet.render`) per staff/admin render; RLS requires `created_by`/`actor` = the user. */
  async record(client: SupabaseClient, p: Packet, actor: Actor): Promise<void> {
    const params = { variant: p.variant, scope: p.scope, status: 'rendered', asOf: p.asOf };
    const job = await client.from('export_job').insert({ org_id: actor.orgId, type: actor.exportType ?? EXPORT_TYPE, params, suppression_applied: true, created_by: actor.userId }).select('id').single();
    if (job.error) throw new Error(job.error.message);
    const audit = await client.from('audit_log').insert({ org_id: actor.orgId, actor: actor.userId, action: AUDIT_ACTION, entity: 'export_job', entity_id: job.data.id, details: params });
    if (audit.error) throw new Error(audit.error.message);
  },
};
