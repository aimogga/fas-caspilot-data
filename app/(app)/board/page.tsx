import { randomUUID } from "node:crypto";
import "@/components/board/print.css";
import { PrintButton } from "@/components/board/PrintButton";
import { FreshnessWidget } from "@/components/dashboard/FreshnessWidget";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { metricProps } from "@/components/dashboard/metric-props";
import { ErrorState, Grid, PageHeader, Stack } from "@/components/layout";
import { BoardQuery, boardFilters, type BoardData } from "@/lib/board/query";
import { summarize } from "@/lib/board/summary";
import { METRIC_CARDS, NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { quarterLabel } from "@/lib/dashboard/filters";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
/** F-402 board dashboard: one screen, plain language, the same suppressed aggregates as the team dashboard, print-friendly, as-of on every number. */
export default async function BoardPage() {
  const now = new Date(), filters = boardFilters(now);
  let data: BoardData | null = null;
  try {
    const client = await createClient();
    data = client ? await BoardQuery.load(client, now) : null;
  } catch (e) {
    console.error("[board] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  const asOf = data?.asOf ?? NOT_AVAILABLE, metrics = data?.metrics ?? null;
  const [m1, ...rest] = METRIC_CARDS, o1 = METRIC_CARDS.find((c) => c.id === "o1");
  const card = (c: (typeof METRIC_CARDS)[number]) => <MetricCard key={c.id} card={c} {...metricProps(c.id, metrics, filters, "/board")} />;
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="BOARD" title="How FAS help is working" description={`${quarterLabel(filters.period)} · All counties · Data as of ${asOf}`} actions={<PrintButton />} />
      {data ? null : <ErrorState message="Couldn't load the board dashboard" referenceId={randomUUID()} href="/board">Something went wrong on our side. Try again.</ErrorState>}
      <p data-slot="board-summary" className="max-w-prose text-base leading-7">{summarize(metrics, asOf)}</p>
      {m1 ? card(m1) : null}
      <Grid cols={3}>{rest.slice(0, 3).map(card)}</Grid>
      <Grid cols={2} className="md:grid-cols-1 lg:grid-cols-2">{rest.slice(3, 5).map(card)}</Grid>
      {o1 ? card(o1) : null}
      {data?.freshness ? <FreshnessWidget view={data.freshness} /> : null}
      <p data-slot="board-note" className="text-sm text-muted-foreground">
        Counts under 11 are hidden to protect families&apos; privacy. Dates are shown by quarter. Data as of {asOf}. FAS Evidence.
      </p>
    </Stack>
  );
}
