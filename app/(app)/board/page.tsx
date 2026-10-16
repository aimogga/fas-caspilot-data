import { randomUUID } from "node:crypto";
import "@/components/board/print.css";
import { KpiRow } from "@/components/board/KpiRow";
import { Pictures } from "@/components/board/Pictures";
import { PrintButton } from "@/components/board/PrintButton";
import { FreshnessWidget } from "@/components/dashboard/FreshnessWidget";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { metricProps } from "@/components/dashboard/metric-props";
import { ErrorState, Grid, PageHeader, Stack } from "@/components/layout";
import { ExplainCard } from "@/components/trust/explain";
import { buttonVariants } from "@/components/ui/button";
import { boardKpis } from "@/lib/board/kpis";
import { BoardQuery, boardFilters, type BoardData } from "@/lib/board/query";
import { summarize } from "@/lib/board/summary";
import { asOfLabel, METRIC_CARDS, NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { quarterWords } from "@/lib/dashboard/format";
import { whyHidden } from "@/lib/trust/glossary";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
/** Board members download the statewide board packet (George, 2026-10-15); the links sit in the header actions, hidden in print. */
const download = (format: "docx" | "csv", label: string) => (
  <a key={format} data-slot="packet-download" className={buttonVariants({ variant: "outline" })} href={`/api/packets/export?variant=board&format=${format}`}>{label}</a>
);
/** F-402 board dashboard: one screen, plain language, the quarter as four pictures first, the same suppressed aggregates as the team dashboard, print-friendly, as-of on every number. */
export default async function BoardPage() {
  const now = new Date(), filters = boardFilters(now);
  let data: BoardData | null = null;
  let errorId: string | undefined;
  try {
    // Board viewers cannot read FAS record rows (RLS: admin/staff only), so the aggregates are computed server-side with the
    // service role and only MetricsQuery's suppressed numbers reach the page; without the key the user's session is used.
    const client = createServiceClient() ?? (await createClient());
    data = client ? await BoardQuery.load(client, now) : null;
  } catch (e) {
    errorId = randomUUID();
    console.error("[board] load failed", { referenceId: errorId, message: e instanceof Error ? e.message : "unknown", stack: e instanceof Error ? e.stack : undefined });
  }
  const asOf = data?.asOf ?? NOT_AVAILABLE, metrics = data?.metrics ?? null;
  const [m1, ...rest] = METRIC_CARDS, o1 = METRIC_CARDS.find((c) => c.id === "o1");
  // Direct children of the header's actions slot: globals.css gives each the tap minimum and the row/column layout.
  const actions = <><PrintButton />{download("docx", "Download Word (.docx)")}{download("csv", "Download CSV appendix")}</>;
  const card = (c: (typeof METRIC_CARDS)[number]) => <MetricCard key={c.id} card={c} {...metricProps(c.id, metrics, filters, "/board")} />;
  const when = quarterWords(filters.period), DT = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="Family Advocacy Services · Board summary" title={`How families fared, ${when}`} description="County totals only. Anything under 11 families is hidden." actions={actions} />
      {data ? null : <ErrorState message="Couldn't load the board dashboard" referenceId={errorId ?? randomUUID()} href="/board">Something went wrong on our side. Try again.</ErrorState>}
      <dl data-slot="board-asof" className="grid max-w-prose grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className={DT}>Data as of</dt>
        <dd><ExplainCard term="as_of" value={asOf} source={data ? "FAS records" : undefined} hidden={asOf === NOT_AVAILABLE ? whyHidden("not_available") : undefined}>{asOf}</ExplainCard></dd>
        <dt className={DT}>Period</dt><dd>{when}, the latest complete quarter</dd>
        <dt className={DT}>Counties</dt><dd>All counties, county totals only</dd>
      </dl>
      <p data-slot="board-summary" className="max-w-prose text-base leading-7">{summarize(metrics, asOf)}</p>
      <KpiRow kpis={boardKpis(metrics, filters.period)} period={filters.period} />
      <Pictures metrics={metrics} period={filters.period} />
      <h2 className="font-serif text-xl font-semibold">The numbers behind the pictures</h2>
      {m1 ? card(m1) : null}
      <Grid cols={3}>{rest.slice(0, 3).map(card)}</Grid>
      <Grid cols={2} className="md:grid-cols-1 lg:grid-cols-2">{rest.slice(3, 5).map(card)}</Grid>
      {o1 ? card(o1) : null}
      {data?.freshness ? <FreshnessWidget view={data.freshness} /> : null}
      <p data-slot="board-note" className="text-sm text-muted-foreground">
        Counts under 11 are hidden to protect families&apos; privacy. Dates are shown by quarter. {asOfLabel(asOf)}. FAS Evidence.
      </p>
    </Stack>
  );
}
