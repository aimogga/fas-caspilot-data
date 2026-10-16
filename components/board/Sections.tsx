import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { ErrorState, Grid } from "@/components/layout";
import { SourceFooter } from "@/components/trust";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { Hint } from "@/components/trust/explain";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { BoardCounties } from "@/lib/board/counties";
import { boardPictures } from "@/lib/board/pictures";
import type { BoardSection } from "@/lib/board/sections";
import { NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { quarterLabel } from "@/lib/dashboard/filters";
import type { DashboardMetrics } from "@/lib/dashboard/metrics-query";
import { whyHidden } from "@/lib/trust/glossary";
import { cn } from "@/lib/utils";

const EYEBROW = "text-xs font-semibold uppercase tracking-wide text-muted-foreground", MUTED = "max-w-prose text-sm text-muted-foreground";
// One serif headline per section: the chart's own caption steps down to sans so the finding sentence stays the headline.
const PLAIN = "[&_figcaption>span:last-child]:font-sans [&_figcaption>span:last-child]:text-sm [&_figcaption>span:last-child]:text-muted-foreground";
const TH = "py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
/** DS-13b "Need in the counties we serve": a real table (the picture is the ranking itself); every rank cell explains itself under one `ExplainLayer`. */
function CountyTable({ c }: { c: BoardCounties }) {
  const footer = { source: "Public sources", period: c.source, n: `= ${c.rows.length} counties`, asOf: c.asOf };
  return (
    <ExplainLayer className="flex flex-col gap-3">
      <table data-slot="county-table" className="w-full text-sm">
        <caption className="sr-only">FAS service counties by statewide need rank</caption>
        <thead><tr className="border-b border-border"><th scope="col" className={TH}>County</th><th scope="col" className={cn(TH, "text-right")}>Rank statewide</th><th scope="col" className={cn(TH, "text-right")}>Need score</th></tr></thead>
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.fips} data-county={r.fips} className="border-b border-border last:border-0">
              <th scope="row" className="py-2 text-left font-normal">{r.name}</th>
              <td className="py-2 text-right tabular-nums"><span tabIndex={0} data-term="rank" data-value={r.rank == null ? r.status : `${r.rank} of ${r.of}`} data-source={c.source} data-asof={c.asOf} data-hidden={r.hidden ?? undefined}
                className="inline-flex min-h-11 items-center rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 lg:min-h-0">{r.rank == null ? r.status : `${r.rank} of ${r.of}`}</span></td>
              <td className="py-2 text-right tabular-nums">{r.rank == null ? <span className="text-muted-foreground">—</span> : r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceFooter {...footer} detail={{ vintage: c.version ?? undefined }} />
    </ExplainLayer>
  );
}
/** DS-13b: four numbered sections in words. Eyebrow (number and question) → serif finding sentence → supporting sentence → the pictures → source line and View as table. */
export function Sections({ sections, metrics, counties, period }: { sections: BoardSection[]; metrics: DashboardMetrics | null; counties: BoardCounties; period: string }) {
  const pictures = boardPictures(metrics), footer = (n: number, asOf: string) => ({ source: "FAS records", period: quarterLabel(period), n: `= ${n}`, asOf });
  return (
    <>
      {sections.map((s) => {
        const pics = pictures.filter((p) => s.pictures.includes(p.id));
        return (
          <section key={s.id} data-slot="board-section" data-section={s.id} data-state={s.state} aria-labelledby={`section-${s.id}`} className="flex flex-col gap-4 border-t border-border pt-8">
            <p data-slot="section-eyebrow" className={EYEBROW}><span className="tabular-nums">{s.no}</span> · {s.question}</p>
            <h2 id={`section-${s.id}`} className="max-w-prose font-serif text-2xl font-semibold leading-snug">{s.finding}</h2>
            {s.state === "error" ? <ErrorState message="Couldn't load this section" referenceId={`board-${s.id}`} href="/board">{s.support}</ErrorState> : s.support ? <p data-slot="section-support" className={MUTED}>{s.support}</p> : null}
            {pics.length ? (
              <Grid cols={pics.length > 1 ? 2 : 1} className={PLAIN}>
                {pics.map(({ id, kind, n, asOf, ...p }) => (
                  <Card key={id} data-picture={id} className="h-full"><CardContent>{kind === "line" ? <LineChart {...p} footer={footer(n, asOf)} periodHead="Quarter" /> : <BarChart {...p} footer={footer(n, asOf)} />}</CardContent></Card>
                ))}
              </Grid>
            ) : null}
            {s.id === "need" && counties.state === "value" ? <Card><CardContent><CountyTable c={counties} /></CardContent></Card> : null}
            {s.id === "need" ? <a href="/need-map?fas=1" data-slot="open-map" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>Open the county need map</a> : null}
          </section>
        );
      })}
    </>
  );
}
/** The artboard's packet card, without the fields the app does not store: no generated date, page count or next meeting until a packet record exists. */
export function PacketCard({ when }: { when: string }) {
  return (
    <section data-slot="packet-card" aria-labelledby="packet-title" className="flex flex-col gap-3 border-t border-border pt-8">
      <p className={EYEBROW}>Board packet</p>
      <h2 id="packet-title" className="font-serif text-2xl font-semibold leading-snug">A saved packet for {when} is <Hint text={whyHidden("not_available")} className="underline decoration-dotted underline-offset-4">{NOT_AVAILABLE.toLowerCase()}</Hint>.</h2>
      <p className={MUTED}>Packets are not stored yet, so there is no generated date or page count to show. Print this page or download the files above for today&apos;s numbers.</p>
    </section>
  );
}
