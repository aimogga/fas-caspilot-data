import { describe, expect, it } from 'vitest';
import { auditPackets, ORG_TABLES, orgScoped } from './audit';

/** A fake client: records every `from(table)` and the `eq` filters applied after `select`; every read resolves to `rows(table)`. */
function fake(rows: (table: string) => unknown[]) {
  const calls: { table: string; eq: [string, unknown][] }[] = [];
  const client = {
    from(table: string) {
      const call = { table, eq: [] as [string, unknown][] };
      calls.push(call);
      const q: Record<string, unknown> = {};
      for (const m of ['gte', 'lte', 'order', 'limit', 'in', 'not', 'is', 'single', 'maybeSingle']) q[m] = () => q;
      q.eq = (k: string, v: unknown) => { call.eq.push([k, v]); return q; };
      q.select = () => q;
      q.then = (ok: (r: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: rows(table), error: null }).then(ok, bad);
      return q;
    },
    rpc: async () => ({ data: [], error: null }),
  };
  return { client: client as never, calls };
}

describe('F-601 packet audit (lib/packets/audit.ts)', () => {
  it('orgScoped pins org tables and views to one org and leaves public tables alone', async () => {
    const { client, calls } = fake(() => []);
    const scoped = orgScoped(client, 'org-1');
    await scoped.from('m4_m5_m6_episodes').select('episode_id').gte('anchor_date', '2026-01-01');
    await scoped.from('need_score').select('fips');
    expect(calls).toEqual([{ table: 'm4_m5_m6_episodes', eq: [['org_id', 'org-1']] }, { table: 'need_score', eq: [] }]);
    expect(ORG_TABLES).toContain('case');
  });
  it('auditPackets builds the board, statewide grant and one county grant packet per org from its cases, all org-scoped, with no findings on empty data', async () => {
    const { client, calls } = fake((t) => (t === 'case' ? [{ county_fips: '49035' }, { county_fips: '49035' }, { county_fips: null }] : []));
    const out = await auditPackets(client, ['aaaaaaaa-1', 'bbbbbbbb-2'], new Date('2026-10-17T00:00:00Z'));
    expect(out.checked).toEqual(['org aaaaaaaa · board', 'org aaaaaaaa · grant', 'org aaaaaaaa · grant · 49035', 'org bbbbbbbb · board', 'org bbbbbbbb · grant', 'org bbbbbbbb · grant · 49035']);
    expect(out.findings).toEqual([]);
    for (const c of calls.filter((x) => ORG_TABLES.includes(x.table))) expect(c.eq.filter(([k]) => k === 'org_id')).toHaveLength(1);
    expect(calls.some((c) => c.table === 'export_job' || c.table === 'audit_log')).toBe(false);
  });
});
