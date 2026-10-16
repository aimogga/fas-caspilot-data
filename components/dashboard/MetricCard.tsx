import type { ReactNode } from "react";
import { ErrorState } from "@/components/layout";
import { SourceFooter, SuppressedCell, type SourceFooterProps } from "@/components/trust";
import { ExplainCard, Hint } from "@/components/trust/explain";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NOT_AVAILABLE, notAvailableNote, type DashboardCard } from "@/lib/dashboard/cards";
import { term, whyHidden } from "@/lib/trust/glossary";
import { cn } from "@/lib/utils";
/** DS-07 metric card. With only `card` it is "Not available yet"; `footer` marks a wired card and `value === null` a suppressed one.
 * Table cards (M4, M6, O1) pass `body` instead of `value`: suppression then lives in their cells. */
export type MetricCardProps = {
  card: DashboardCard; value?: string | null; valueText?: string; stats?: string; delta?: string | null; deltaHint?: string; subline?: string | null; muted?: string;
  footer?: SourceFooterProps; trend?: ReactNode; n?: number; rows?: number; filtered?: boolean; noData?: string; error?: string; body?: ReactNode; href?: string;
};
const BIG = "text-[2rem] leading-none font-semibold tabular-nums", SMALL = "text-sm text-muted-foreground";
/** Not available until a footer arrives; filter-no-results, no-data and suppression are decided from `rows`, `n` and `value`. */
const stateOf = (p: MetricCardProps) =>
  p.error ? "error" : !p.footer ? "not-available" : p.rows === 0 && p.filtered ? "no-match" : p.n === 0 ? "no-data" : p.body || p.value != null ? "value" : "suppressed";
function Body({ p, state }: { p: MetricCardProps; state: ReturnType<typeof stateOf> }) {
  switch (state) {
    case "error": return <ErrorState message="Couldn't load this number" referenceId={p.error as string} href={p.href ?? "/dashboard"} />;
    case "no-match": return <><p className="font-medium">No cases match these filters</p><a href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>Reset filters</a></>;
    case "no-data": return <p className="font-medium">{p.noData}</p>;
    case "suppressed": return <p className={BIG}><SuppressedCell /></p>;
    case "value": return p.body ?? (
      <>
        <p className={BIG}>{p.valueText ? <><span aria-hidden>{p.value}</span><span className="sr-only">{p.valueText}</span></> : p.value}</p>
        {p.stats ? <p className={cn(SMALL, "tabular-nums")}>{p.stats}</p> : null}
        {p.delta ? <p data-slot="delta" className="text-sm font-medium">{p.deltaHint ? <Hint text={p.deltaHint}>{p.delta}</Hint> : p.delta}</p> : null}
        {p.subline ? <p className="text-sm">{p.subline}</p> : null}
        {p.muted ? <p className={SMALL}>{p.muted}</p> : null}
      </>
    );
    default: return <><p className="font-medium">{NOT_AVAILABLE}</p><p className={SMALL}>{notAvailableNote(p.card.metricName)}</p></>;
  }
}
export function MetricCard(p: MetricCardProps) {
  const headingId = `card-${p.card.id}-title`, state = stateOf(p), live = state !== "error";
  // DS-09: the title's Info button explains the metric, its source and as-of, and why the value is hidden when it is.
  const hidden = state === "suppressed" ? whyHidden("suppressed") : state === "not-available" ? whyHidden("not_available") : state === "error" ? whyHidden("error") : undefined;
  return (
    <section aria-labelledby={headingId} data-slot="metric-card" data-state={state}><Card className="h-full">
      <CardHeader><CardTitle className="flex items-center gap-1"><h2 id={headingId} className="text-base font-semibold">{p.card.title}</h2><ExplainCard icon term={term(p.card.id)} source={p.footer?.source} asOf={live ? p.footer?.asOf : undefined} hidden={hidden} /></CardTitle></CardHeader>
      <CardContent className={cn("grid gap-4", p.trend && "lg:grid-cols-2")}>
        <div className="flex flex-col gap-2"><Body p={p} state={state} />{p.footer && live ? <SourceFooter {...p.footer} /> : null}</div>
        {p.trend && live ? p.trend : null}
      </CardContent>
    </Card></section>
  );
}
