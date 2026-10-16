import { randomUUID } from "node:crypto";
import "@/components/board/print.css";
import { KpiRow } from "@/components/board/KpiRow";
import { PrintButton } from "@/components/board/PrintButton";
import { PacketCard, Sections } from "@/components/board/Sections";
import { Sources } from "@/components/board/Sources";
import { Cluster, ErrorState, PageHeader, Stack } from "@/components/layout";
import { ExplainCard } from "@/components/trust/explain";
import { buttonVariants } from "@/components/ui/button";
import { boardCounties } from "@/lib/board/counties";
import { boardKpis } from "@/lib/board/kpis";
import { BoardQuery, boardFilters, type BoardData } from "@/lib/board/query";
import { boardSections, LEAD } from "@/lib/board/sections";
import { sourcesParagraph } from "@/lib/board/sources";
import { NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { quarterLabel } from "@/lib/dashboard/filters";
import { quarterWords } from "@/lib/dashboard/format";
import { NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";
import { whyHidden } from "@/lib/trust/glossary";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
/** Board members download the statewide board packet (George, 2026-10-15); the links sit in the actions row, hidden in print. */
const download = (format: "docx" | "csv", label: string) => (
  <a key={format} data-slot="packet-download" className={cn(buttonVariants({ variant: "outline" }), "min-h-11")} href={`/api/packets/export?variant=board&format=${format}`}>{label}</a>
);
const warn = (what: string) => (e: unknown) => { console.error(`[board] ${what} failed`, { message: e instanceof Error ? e.message : "unknown", stack: e instanceof Error ? e.stack : undefined }); return null; };
/** F-402 board dashboard: one screen, plain language, the quarter as four sections in words (DS-13b), the same suppressed aggregates as the team dashboard, print-friendly, as-of on every number. */
export default async function BoardPage() {
  const now = new Date(), filters = boardFilters(now);
  let data: BoardData | null = null, need: NeedTableData | null = null;
  let errorId: string | undefined;
  try {
    // Board viewers cannot read FAS record rows (RLS: admin/staff only), so the aggregates are computed server-side with the
    // service role and only MetricsQuery's suppressed numbers reach the page; without the key the user's session is used.
    const client = createServiceClient() ?? (await createClient());
    // The county need section loads beside the metrics; a failed need load only words that section as not available.
    [data, need] = client ? await Promise.all([BoardQuery.load(client, now), NeedMapQuery.load(client).catch(warn("county need"))]) : [null, null];
  } catch (e) {
    errorId = randomUUID();
    console.error("[board] load failed", { referenceId: errorId, message: e instanceof Error ? e.message : "unknown", stack: e instanceof Error ? e.stack : undefined });
  }
  const asOf = data?.asOf ?? NOT_AVAILABLE, metrics = data?.metrics ?? null, counties = boardCounties(need), sections = boardSections(metrics, counties);
  const when = quarterWords(filters.period), DT = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
  const n = (["m1", "m2", "m3", "m4", "m5", "m6", "o1"] as const).reduce((t, k) => { const m = metrics?.[k]; return m && !("error" in m) ? Math.max(t, m.n) : t; }, 0);
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="Family Advocacy Services · Board summary" title={`How families fared, ${when}`} description="County totals only. Anything under 11 families is hidden." />
      {/* DS-13b: the actions sit on their own row under the title so the H1 keeps the full width at 1024 (the header grid squeezed it into a four-line column). */}
      <Cluster gap={3} className="print:hidden [&_button]:min-h-11"><div data-slot="actions" className="contents"><PrintButton />{download("docx", "Download Word (.docx)")}{download("csv", "Download CSV appendix")}</div></Cluster>
      {data ? null : <ErrorState message="Couldn't load the board dashboard" referenceId={errorId ?? randomUUID()} href="/board">Something went wrong on our side. Try again.</ErrorState>}
      <dl data-slot="board-asof" className="grid max-w-prose grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className={DT}>Data as of</dt>
        <dd><ExplainCard term="as_of" value={asOf} source={data ? "FAS records" : undefined} hidden={asOf === NOT_AVAILABLE ? whyHidden("not_available") : undefined}>{asOf}</ExplainCard></dd>
        <dt className={DT}>Period</dt><dd>{when}, the latest complete quarter</dd>
        <dt className={DT}>Counties</dt><dd>All counties, county totals only</dd>
      </dl>
      <p data-slot="board-lead" className="max-w-prose text-base leading-7">{LEAD}</p>
      <KpiRow kpis={boardKpis(metrics, filters.period)} period={filters.period} />
      <Sections sections={sections} metrics={metrics} counties={counties} period={filters.period} />
      <PacketCard when={when} />
      <Sources text={sourcesParagraph(metrics, filters.period, asOf, counties)} period={quarterLabel(filters.period)} n={n} asOf={asOf} footer={`FAS Evidence · Board summary · ${when} · County totals only`} />
    </Stack>
  );
}
