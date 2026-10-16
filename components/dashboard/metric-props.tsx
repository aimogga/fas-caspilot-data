import { randomUUID } from "node:crypto";
import { M4Table } from "@/components/dashboard/M4Table";
import { M6Card } from "@/components/dashboard/M6Card";
import type { MetricCardProps } from "@/components/dashboard/MetricCard";
import { OutcomesCard } from "@/components/dashboard/OutcomesCard";
import { TrendLine } from "@/components/dashboard/TrendLine";
import { METRIC_CARDS } from "@/lib/dashboard/cards";
import { priorQuarter, quarterLabel, type Filters } from "@/lib/dashboard/filters";
import { days, money, pct, quarterShort, reasonLabel } from "@/lib/dashboard/format";
import type { DashboardMetrics, Loaded, Wired } from "@/lib/dashboard/metrics-query";
import { deltaHint, m1Stats } from "@/lib/dashboard/words";

export const NO_CASES = "No closed cases this quarter", NO_EPISODES = "Not enough closed episodes", NO_SCORES = "No follow-up scores this quarter", HIDDEN_BANDS = " · includes hidden bands";
/** Card props for a wired FAS metric (DS-07b/c): footer, states and delta from the view; `body` adds the formatted value or table. Shared by the team and board dashboards. */
export function metricProps(id: string, x: DashboardMetrics | null, f: Filters, href = "/dashboard"): Partial<MetricCardProps> {
  const footer = (m: Wired, suffix = "") => ({ source: "FAS records", period: quarterLabel(f.period), n: `= ${m.n}`, asOf: m.asOf + suffix });
  const fas = <T extends Wired>(m: Loaded<T> | undefined, noData: string, body: (v: T) => Partial<MetricCardProps>): Partial<MetricCardProps> => {
    if (!m) return {};
    if ("error" in m) return { error: randomUUID(), href };
    // DS-15a: every delta carries a hint naming the prior quarter in full; lower is better for each metric that shows one (M1, M2, M3, M5).
    return { n: m.n, rows: m.viewRows, filtered: x?.filtered, noData, delta: m.delta, deltaHint: deltaHint(m.delta, "down", priorQuarter(f.period)), footer: footer(m), href, ...body(m) };
  };
  switch (id) {
    case "m1": return fas(x?.m1, NO_CASES, (v) => ({
      value: days(v.median), valueText: `Median ${days(v.median)} from court order to first session, ${quarterShort(f.period)} ${f.period.slice(0, 4)}`,
      stats: m1Stats(v),
      trend: x ? <TrendLine points={x.trend} label={METRIC_CARDS[0]?.title ?? ""} /> : null,
    }));
    case "m2": return fas(x?.m2, NO_CASES, (v) => ({ value: days(v.median) }));
    case "m3": return fas(x?.m3, NO_CASES, (v) => ({ value: pct(v.share), subline: v.topReason ? `Top reason: ${reasonLabel(v.topReason)}` : null, muted: "No session within 60 days of approval" }));
    case "m5": return fas(x?.m5, NO_EPISODES, (v) => ({ value: money(v.costPerCompleted), subline: `Program total ÷ completed: ${money(v.programPerCompleted)}` }));
    case "m4": return fas(x?.m4, NO_EPISODES, (v) => ({ body: <M4Table data={v} asOf={v.asOf} />, footer: footer(v, v.includesHiddenBands ? HIDDEN_BANDS : "") }));
    case "m6": return fas(x?.m6, NO_EPISODES, (v) => ({ body: <M6Card data={v} asOf={v.asOf} /> }));
    case "o1": return fas(x?.o1, NO_SCORES, (v) => ({ body: <OutcomesCard data={v} asOf={v.asOf} /> }));
    default: return {};
  }
}
