/** F-402 plain-English board summary. Pure sentence builders over the suppressed `DashboardMetrics`: a number is only written when it is present
 * (n ≥ 11, not suppressed); a hidden count is worded `fewer than 11`; nothing is estimated or invented. */
import { asOfLabel, GROUP_LABELS } from '../dashboard/cards';
import { days, money, num, pct, reasonLabel, signed } from '../dashboard/format';
import type { DashboardMetrics, Loaded, Wired } from '../dashboard/metrics-query';

const FEWER = 'fewer than 11';
/** `↓ 4 days faster than Q2` → `, 4 days faster than the quarter before`; `No change from Q2` → `, the same as the quarter before`; null → ``. */
export function deltaPhrase(delta: string | null | undefined): string {
  if (!delta) return '';
  if (delta.startsWith('No change')) return ', the same as the quarter before';
  return `, ${delta.replace(/^[↑↓]\s*/, '').replace(/ than Q[1-4]$/, ' than the quarter before')}`;
}
const ok = <T extends Wired>(m: Loaded<T> | undefined): m is T & Wired => !!m && !('error' in m);
export const sentences = {
  m1(m: Loaded<{ median: number | null }> | undefined): string | null {
    if (!ok(m)) return null;
    if (m.n === 0) return 'No court-ordered case reached a first session this quarter.';
    if (m.median == null) return `Fewer than 11 court-ordered cases reached a first session this quarter, so the wait time is hidden.`;
    return `Families referred by a court waited a median of ${days(m.median)} for a first session${deltaPhrase(m.delta)}.`;
  },
  m2(m: Loaded<{ median: number | null }> | undefined): string | null {
    if (!ok(m)) return null;
    if (m.n === 0) return 'No funding applications were decided this quarter.';
    if (m.median == null) return `Fewer than 11 applications were decided, so the time to a funding decision is hidden.`;
    return `Funding decisions took a median of ${days(m.median)} from application${deltaPhrase(m.delta)}.`;
  },
  m3(m: Loaded<{ share: number | null; topReason: string | null }> | undefined): string | null {
    if (!ok(m)) return null;
    if (m.n === 0) return 'No families were approved for funding this quarter.';
    if (m.share == null) return `The share of approved families who never started therapy is hidden because it rests on ${FEWER} families.`;
    const reason = m.topReason ? ` (most often: ${reasonLabel(m.topReason).toLowerCase()})` : '';
    return `${pct(m.share)} of approved families never started therapy within 60 days${reason}${deltaPhrase(m.delta)}.`;
  },
  m5(m: Loaded<{ costPerCompleted: number | null }> | undefined): string | null {
    if (!ok(m)) return null;
    if (m.n === 0) return 'No course of therapy was completed this quarter.';
    if (m.costPerCompleted == null) return `Fewer than 11 courses of therapy were completed, so the cost per completed course is hidden.`;
    return `Each completed course of therapy cost ${money(m.costPerCompleted)} on average${deltaPhrase(m.delta)}.`;
  },
  m4(m: Loaded<{ total: { completed: number | null; closed: number | null; rate: number | null } | null; includesHiddenBands: boolean }> | undefined): string | null {
    if (!ok(m) || m.n === 0) return null;
    const t = m.total;
    if (!t || t.rate == null || t.completed == null || t.closed == null) return `Fewer than 11 cases closed, so completion rates by income band are hidden.`;
    return `Across all income bands, ${pct(t.rate)} of closed cases finished therapy (${num(t.completed)} of ${num(t.closed)})${m.includesHiddenBands ? '; bands with fewer than 11 cases are hidden' : ''}.`;
  },
  m6(m: Loaded<{ affiliatedShare: number | null; groups: { group: string; avgRatePerUnit: number | null }[] }> | undefined): string | null {
    if (!ok(m) || m.n === 0) return null;
    if (m.affiliatedShare == null) return `One provider group had ${FEWER} episodes, so the split of therapy dollars is hidden.`;
    const rate = (g: string) => m.groups.find((x) => x.group === g)?.avgRatePerUnit;
    const [a, o] = [rate('affiliated'), rate('other')], rates = a != null && o != null ? `, at an average of ${money(a)} per hour versus ${money(o)} for ${GROUP_LABELS.other?.toLowerCase()}` : '';
    return `${pct(m.affiliatedShare)} of therapy dollars went to providers affiliated with FAS${rates}.`;
  },
  o1(m: Loaded<{ measures: { code: string; n: number; meanChange: number | null; shareImproved: number | null }[] }> | undefined): string | null {
    if (!ok(m)) return null;
    if (m.n === 0) return 'No follow-up scores were recorded this quarter.';
    return m.measures.filter((x) => x.n > 0).map((x) =>
      x.meanChange == null || x.shareImproved == null ? `Fewer than 11 families had ${x.code} follow-up scores, so that change is hidden.`
        : `On the ${x.code}, scores changed by ${signed(x.meanChange)} on average and ${pct(x.shareImproved)} of families improved (lower is better).`).join(' ');
  },
};
/** The whole paragraph; `null` metrics (page could not load) read as not available. */
export function summarize(x: DashboardMetrics | null, asOf: string): string {
  if (!x) return 'This quarter’s numbers are not available yet.';
  const parts = [sentences.m1(x.m1), sentences.m2(x.m2), sentences.m3(x.m3), sentences.m5(x.m5), sentences.m4(x.m4), sentences.m6(x.m6), sentences.o1(x.o1)].filter(Boolean);
  return `${parts.length ? parts.join(' ') : 'This quarter’s numbers are not available yet.'} ${asOfLabel(asOf)}.`;
}
