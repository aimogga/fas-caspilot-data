import { randomUUID } from "node:crypto";
import { ErrorState, Grid, PageHeader, Stack } from "@/components/layout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { FreshnessWidget } from "@/components/dashboard/FreshnessWidget";
import { M4Table } from "@/components/dashboard/M4Table";
import { M6Card } from "@/components/dashboard/M6Card";
import { MetricCard, type MetricCardProps } from "@/components/dashboard/MetricCard";
import { OutcomesCard } from "@/components/dashboard/OutcomesCard";
import { PipelineWidget } from "@/components/dashboard/PipelineWidget";
import { TrendLine } from "@/components/dashboard/TrendLine";
import { METRIC_CARDS } from "@/lib/dashboard/cards";
import { describeFilters, parseFilters, quarterLabel, type Filters, type SearchParams } from "@/lib/dashboard/filters";
import { days, money, num, pct, quarterShort, reasonLabel } from "@/lib/dashboard/format";
import { MetricsQuery, type DashboardMetrics, type Loaded, type Wired } from "@/lib/dashboard/metrics-query";
import { DashboardQuery, type DashboardData } from "@/lib/dashboard/query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const NO_CASES = "No closed cases this quarter", NO_EPISODES = "Not enough closed episodes", HIDDEN_BANDS = " · includes hidden bands";
/** Card props for a wired FAS metric (DS-07b/c): footer, states and delta from the view; `body` adds the formatted value or table. */
function metricProps(id: string, x: DashboardMetrics | null, f: Filters): Partial<MetricCardProps> {
  const footer = (m: Wired, suffix = "") => ({ source: "FAS records", period: quarterLabel(f.period), n: `= ${m.n}`, asOf: m.asOf + suffix });
  const fas = <T extends Wired>(m: Loaded<T> | undefined, noData: string, body: (v: T) => Partial<MetricCardProps>): Partial<MetricCardProps> => {
    if (!m) return {};
    if ("error" in m) return { error: randomUUID() };
    return { n: m.n, rows: m.viewRows, filtered: x?.filtered, noData, delta: m.delta, footer: footer(m), ...body(m) };
  };
  switch (id) {
    case "m1": return fas(x?.m1, NO_CASES, (v) => ({
      value: days(v.median), valueText: `Median ${days(v.median)} from court order to first session, ${quarterShort(f.period)} ${f.period.slice(0, 4)}`,
      stats: [v.p25 != null ? `25th pct ${num(v.p25)}` : null, v.p75 != null ? `75th pct ${num(v.p75)}` : null, `n = ${v.n}`, v.stillWaitingShare == null ? null : `Still waiting ${pct(v.stillWaitingShare)}`].filter(Boolean).join(" · "),
      trend: x ? <TrendLine points={x.trend} label={METRIC_CARDS[0]?.title ?? ""} /> : null,
    }));
    case "m2": return fas(x?.m2, NO_CASES, (v) => ({ value: days(v.median) }));
    case "m3": return fas(x?.m3, NO_CASES, (v) => ({ value: pct(v.share), subline: v.topReason ? `Top reason: ${reasonLabel(v.topReason)}` : null, muted: "No session within 60 days of approval" }));
    case "m5": return fas(x?.m5, NO_EPISODES, (v) => ({ value: money(v.costPerCompleted), subline: `Program total ÷ completed: ${money(v.programPerCompleted)}` }));
    case "m4": return fas(x?.m4, NO_EPISODES, (v) => ({ body: <M4Table data={v} />, footer: footer(v, v.includesHiddenBands ? HIDDEN_BANDS : "") }));
    case "m6": return fas(x?.m6, NO_EPISODES, (v) => ({ body: <M6Card data={v} /> }));
    case "o1": return fas(x?.o1, "No follow-up scores this quarter", (v) => ({ body: <OutcomesCard data={v} /> }));
    default: return {};
  }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const now = new Date();
  const params = await searchParams;
  let data: DashboardData | null = null, client: Awaited<ReturnType<typeof createClient>> = null;
  try {
    client = await createClient();
    data = client ? await DashboardQuery.load(client, now) : null;
  } catch (e) {
    console.error("[dashboard] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  const filters = parseFilters(params, now, data?.counties.map((c) => c.fips));
  const metrics = client && data ? await MetricsQuery.load(client, filters) : null;
  const county = data?.counties.find((c) => c.fips === filters.county)?.name ?? null;
  const [m1, ...rest] = METRIC_CARDS, o1 = METRIC_CARDS.find((c) => c.id === "o1");
  const card = (c: (typeof METRIC_CARDS)[number]) => <MetricCard key={c.id} card={c} {...metricProps(c.id, metrics, filters)} />;
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Team dashboard" description={describeFilters(filters, county)} />
      {data ? <FilterBar filters={filters} counties={data.counties} referrals={data.referrals} now={now} /> : null}
      {data ? null : <ErrorState message="Couldn't load the dashboard" referenceId={randomUUID()} href="/dashboard">Something went wrong on our side. Try again.</ErrorState>}
      {m1 ? card(m1) : null}
      <Grid cols={3}>{rest.slice(0, 3).map(card)}</Grid>
      <Grid cols={2} className="md:grid-cols-1 lg:grid-cols-2">{rest.slice(3, 5).map(card)}</Grid>
      {o1 ? card(o1) : null}
      {data ? <Grid cols={2}><FreshnessWidget view={data.freshness} /><PipelineWidget view={data.pipeline} /></Grid> : null}
    </Stack>
  );
}
