/** F-601 check 4 (NIGHTLY_AUDIT.md): build every evidence packet the app can export, per org, and run `assertPacket` on it, so a cell under 11, an exact
 * date, a case field or an unsourced number in a board or export view turns the nightly audit red. Uses the same builders as the packet page and
 * the DOCX/CSV exports (`PacketQuery.load` with no actor, so nothing is written). The audit reads with the service role, which bypasses RLS, so
 * every org-owned table and metric view is filtered to one org here; public tables (need score, sources) are read as they are. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTIES } from '../synthetic/generate';
import { assertPacket, type Violation } from './assert';
import type { PacketScope, PacketVariant } from './model';
import { PacketQuery } from './query';

/** Tables and views the packet reads that carry `org_id` (lib/dashboard/metrics-query.ts VIEWS, the service-county read and the aggregate totals in query.ts). */
export const ORG_TABLES = ['case', 'outcome_measure', 'aggregate_submission', 'm1_court_to_first_session', 'm2_application_to_decision', 'm3_never_started', 'm4_m5_m6_episodes'];
export type PacketFinding = Violation & { packet: string };
export type PacketAudit = { checked: string[]; findings: PacketFinding[] };

/** A client whose `from(t).select(...)` on an org table is pinned to one org; everything else passes through. */
export function orgScoped(client: SupabaseClient, orgId: string): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== 'from') return Reflect.get(target, prop, receiver);
      return (table: string) => {
        const builder = target.from(table);
        if (!ORG_TABLES.includes(table)) return builder;
        return new Proxy(builder, { get: (b, p, r) => (p === 'select' ? (...args: Parameters<typeof b.select>) => b.select(...args).eq('org_id', orgId) : Reflect.get(b, p, r)) });
      };
    },
  });
}

/** Per org: the board packet, the statewide grant packet and one grant packet per Utah county the org has cases in. */
export async function auditPackets(client: SupabaseClient, orgIds: string[], now: Date): Promise<PacketAudit> {
  const out: PacketAudit = { checked: [], findings: [] };
  for (const org of orgIds) {
    const scoped = orgScoped(client, org);
    const cases = await scoped.from('case').select('county_fips');
    if (cases.error) throw new Error(`case: ${cases.error.message}`);
    const fips = new Set((cases.data as { county_fips: string | null }[]).map((c) => c.county_fips));
    const runs: [PacketVariant, PacketScope][] = [['board', {}], ['grant', {}], ...COUNTIES.filter((c) => fips.has(c.fips)).map((c): [PacketVariant, PacketScope] => ['grant', { county: c.fips }])];
    for (const [variant, scope] of runs) {
      const name = `org ${org.slice(0, 8)} · ${variant}${scope.county ? ` · ${scope.county}` : ''}`;
      const packet = await PacketQuery.load(scoped, variant, scope, now);
      out.checked.push(name);
      out.findings.push(...assertPacket(packet).map((v) => ({ ...v, packet: name })));
    }
  }
  return out;
}
