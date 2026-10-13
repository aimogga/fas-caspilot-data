import type { ReactNode } from "react";
import { ErrorState } from "@/components/layout";
import { SourceFooter, SuppressedCell, type SourceFooterProps } from "@/components/trust";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NOT_AVAILABLE, notAvailableNote, type DashboardCard } from "@/lib/dashboard/cards";
import { cn } from "@/lib/utils";
/** DS-07 metric card. With only `card` it is "Not available yet"; `footer` marks a wired card and `value === null` a suppressed one. */
export type MetricCardProps = {
  card: DashboardCard; value?: string | null; valueText?: string; stats?: string; delta?: string | null; subline?: string | null; muted?: string;
  footer?: SourceFooterProps; trend?: ReactNode; n?: number; rows?: number; filtered?: boolean; noData?: string; error?: string;
};
const BIG = "text-[2rem] leading-none font-semibold tabular-nums", SMALL = "text-sm text-muted-foreground";
/** Not available until a footer arrives; filter-no-results, no-data and suppression are decided from `rows`, `n` and `value`. */
const stateOf = (p: MetricCardProps) =>
  p.error ? "error" : !p.footer ? "not-available" : p.rows === 0 && p.filtered ? "no-match" : p.n === 0 ? "no-data" : p.value == null ? "suppressed" : "value";
function Body({ p, state }: { p: MetricCardProps; state: ReturnType<typeof stateOf> }) {
  switch (state) {
    case "error": return <ErrorState message="Couldn't load this number" referenceId={p.error as string} href="/dashboard" />;
    case "no-match": return <><p className="font-medium">No cases match these filters</p><a href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>Reset filters</a></>;
    case "no-data": return <p className="font-medium">{p.noData}</p>;
    case "suppressed": return <p className={BIG}><SuppressedCell /></p>;
    case "value": return (
      <>
        <p className={BIG}>{p.valueText ? <><span aria-hidden>{p.value}</span><span className="sr-only">{p.valueText}</span></> : p.value}</p>
        {p.stats ? <p className={cn(SMALL, "tabular-nums")}>{p.stats}</p> : null}
        {p.delta ? <p data-slot="delta" className="text-sm font-medium">{p.delta}</p> : null}
        {p.subline ? <p className="text-sm">{p.subline}</p> : null}
        {p.muted ? <p className={SMALL}>{p.muted}</p> : null}
      </>
    );
    default: return <><p className="font-medium">{NOT_AVAILABLE}</p><p className={SMALL}>{notAvailableNote(p.card.metricName)}</p></>;
  }
}
export function MetricCard(p: MetricCardProps) {
  const headingId = `card-${p.card.id}-title`, state = stateOf(p), live = state !== "error";
  return (
    <section aria-labelledby={headingId} data-slot="metric-card" data-state={state}><Card className="h-full">
      <CardHeader><CardTitle><h2 id={headingId} className="text-base font-semibold">{p.card.title}</h2></CardTitle></CardHeader>
      <CardContent className={cn("grid gap-4", p.trend && "lg:grid-cols-2")}>
        <div className="flex flex-col gap-2"><Body p={p} state={state} />{p.footer && live ? <SourceFooter {...p.footer} /> : null}</div>
        {p.trend && live ? p.trend : null}
      </CardContent>
    </Card></section>
  );
}
