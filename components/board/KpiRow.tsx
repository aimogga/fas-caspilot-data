import { ErrorState } from "@/components/layout";
import { SourceFooter, SuppressedCell } from "@/components/trust";
import { ExplainCard, Hint } from "@/components/trust/explain";
import type { BoardKpi } from "@/lib/board/kpis";
import { NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { quarterLabel } from "@/lib/dashboard/filters";
import { whyHidden } from "@/lib/trust/glossary";

const FAS = "FAS records";
const BIG = "text-4xl leading-none font-semibold tabular-nums", MUTED = "text-sm text-muted-foreground";
function Body({ k }: { k: BoardKpi }) {
  switch (k.state) {
    case "error": return <ErrorState message="Couldn't load this number" referenceId={`board-${k.id}`} href="/board" />;
    case "not-available": return <><p className="font-medium">{NOT_AVAILABLE}</p><p className={MUTED}>{whyHidden("not_available")}</p></>;
    case "no-data": return <p className="font-medium">{k.noData}</p>;
    case "suppressed": return <p className={BIG}><SuppressedCell /></p>;
    default: return (
      <>
        <p className={BIG}>
          <span aria-hidden>{k.value}{k.unit === "days" ? <span className="ml-1 text-xl font-medium text-muted-foreground">days</span> : null}</span>
          <span className="sr-only">{k.valueText}</span>
        </p>
        {k.detail ? <p data-slot="kpi-detail" className="text-sm">{k.detail}</p> : null}
        {k.compare && k.compareHint ? <p data-slot="kpi-compare" className={MUTED}><Hint text={k.compareHint} className="underline decoration-dotted underline-offset-4">{k.compare}</Hint></p> : null}
      </>
    );
  }
}
/** DS-13a: three numbers in one rule row, label → numeral → what it counts → comparison in words → source line. Each label opens its explain card. */
export function KpiRow({ kpis, period }: { kpis: BoardKpi[]; period: string }) {
  return (
    <section data-slot="kpi-row" aria-label="Three numbers for the quarter" className="grid grid-cols-1 divide-y divide-border border-y border-border md:grid-cols-3 md:divide-x md:divide-y-0">
      {kpis.map((k) => {
        const live = k.state !== "error" && k.state !== "not-available";
        const hidden = k.state === "suppressed" ? whyHidden("suppressed") : k.state === "not-available" ? whyHidden("not_available") : k.state === "error" ? whyHidden("error") : undefined;
        return (
          <div key={k.id} data-slot="kpi" data-metric={k.id} data-state={k.state} className="flex flex-col gap-3 py-6 md:px-6 md:first:pl-0 md:last:pr-0">
            <p className="text-sm font-medium text-muted-foreground">
              <ExplainCard term={k.id} value={k.value ? `${k.value}${k.unit === "days" ? " days" : ""}` : undefined} source={live ? FAS : undefined} asOf={live ? k.asOf : undefined} hidden={hidden}>{k.label}</ExplainCard>
            </p>
            <Body k={k} />
            {live ? <SourceFooter source={FAS} period={quarterLabel(period)} n={`= ${k.n}`} asOf={k.asOf} /> : null}
          </div>
        );
      })}
    </section>
  );
}
