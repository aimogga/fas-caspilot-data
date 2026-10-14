import { randomUUID } from "node:crypto";
import { ErrorState, Grid, PageHeader, Stack } from "@/components/layout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { M4Table } from "@/components/dashboard/M4Table";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PipelineWidget } from "@/components/dashboard/PipelineWidget";
import { METRIC_CARDS } from "@/lib/dashboard/cards";
import { describeFilters, parseFilters, type SearchParams } from "@/lib/dashboard/filters";
import { DashboardQuery, type DashboardData } from "@/lib/dashboard/query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const now = new Date();
  const params = await searchParams;
  let data: DashboardData | null = null;
  try {
    const client = await createClient();
    data = client ? await DashboardQuery.load(client, now) : null;
  } catch (e) {
    console.error("[dashboard] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  const filters = parseFilters(params, now, data?.counties.map((c) => c.fips));
  const county = data?.counties.find((c) => c.fips === filters.county)?.name ?? null;
  const [m1, ...rest] = METRIC_CARDS;
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Team dashboard" description={describeFilters(filters, county)} />
      {data ? <FilterBar filters={filters} counties={data.counties} referrals={data.referrals} now={now} /> : null}
      {data ? null : <ErrorState message="Couldn't load the dashboard" referenceId={randomUUID()} href="/dashboard">Something went wrong on our side. Try again.</ErrorState>}
      <MetricCard card={m1} />
      <Grid cols={3}>{rest.slice(0, 3).map((card) => <MetricCard key={card.id} card={card} />)}</Grid>
      <Grid cols={2}><M4Table />{rest.slice(3).map((card) => <MetricCard key={card.id} card={card} />)}</Grid>
      {data ? <Grid cols={2}><PipelineWidget view={data.pipeline} /></Grid> : null}
    </Stack>
  );
}
