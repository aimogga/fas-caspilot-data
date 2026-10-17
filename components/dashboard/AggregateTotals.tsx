import Link from "next/link";
import { AggregateBadge, SourceFooter, SuppressedCell } from "@/components/trust";
import { Hint } from "@/components/trust/explain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AggregateTotals as Totals } from "@/lib/dashboard/aggregates";
import { quarterLabel } from "@/lib/dashboard/filters";
import { AGGREGATE_BADGE_HINT, AGGREGATE_SOURCE } from "@/lib/intake/words";

const entriesWords = (n: number) => `Added up from ${n} ${n === 1 ? "total" : "totals"} staff entered on the Enter data page.`;

/** F-303: totals FAS entered as totals, always under the Σ Aggregate label and apart from the record-based metrics. `totals` null = read failed. */
export function AggregateTotals({ totals, period, countyName }: { totals: Totals | null; period: string; countyName: string | null }) {
  const where = countyName ? `${countyName} County` : "all counties";
  return (
    <section aria-labelledby="aggregate-title" data-slot="aggregate-totals">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <h2 id="aggregate-title" className="text-base font-semibold">Totals entered as totals</h2>
            <Hint text={AGGREGATE_BADGE_HINT} label="Aggregate submission" className="rounded-full"><AggregateBadge /></Hint>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Kept apart from the numbers above, which are built from individual records. Totals under 11 are hidden to protect privacy.</p>
          {totals === null ? <p className="text-sm">Couldn&apos;t load the entered totals. Reload the page to try again.</p> : null}
          {totals && totals.lines.length === 0 ? (
            <p data-slot="aggregate-empty" className="text-sm">No totals were entered for {quarterLabel(period)} in {where}. Staff add them on <Link href="/staff/entry" className="underline underline-offset-4">Enter data</Link>.</p>
          ) : null}
          {totals && totals.lines.length ? (
            <ul className="divide-y">
              {totals.lines.map((l) => (
                <li key={l.code} data-metric={l.code} className="flex min-h-11 items-center justify-between gap-2 py-2 text-sm lg:min-h-0">
                  <Hint text={entriesWords(l.entries)}>{l.label}</Hint>
                  <span className="text-right tabular-nums">{l.suppressed ? <SuppressedCell /> : l.shown}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {totals && totals.lines.length ? <SourceFooter source={AGGREGATE_SOURCE} period={`${quarterLabel(period)}, ${where}`} n={totals.entries} asOf={totals.asOf} /> : null}
        </CardContent>
      </Card>
    </section>
  );
}
