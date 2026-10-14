import { randomUUID } from "node:crypto";
import { ErrorState, Grid, PageHeader, Stack } from "@/components/layout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { FreshnessWidget } from "@/components/dashboard/FreshnessWidget";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { metricProps } from "@/components/dashboard/metric-props";
import { PipelineWidget } from "@/components/dashboard/PipelineWidget";
import { METRIC_CARDS } from "@/lib/dashboard/cards";
import { describeFilters, parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { MetricsQuery } from "@/lib/dashboard/metrics-query";
import { DashboardQuery, type DashboardData } from "@/lib/dashboard/query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
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
