import { Sparkline } from "@/components/charts/Sparkline";
import { ErrorState, Grid } from "@/components/layout";
import { SourceFooter, SuppressedCell } from "@/components/trust";
import { ExplainCard, Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { quarterLabel } from "@/lib/dashboard/filters";
import type { Kpi } from "@/lib/staff/home";
import { whyHidden } from "@/lib/trust/glossary";

const TONE = { better: "success", worse: "destructive", same: "muted" } as const;
const BIG = "text-4xl leading-none font-semibold tabular-nums", MUTED = "text-sm text-muted-foreground";
const FAS = "FAS records";
function Body({ k, href }: { k: Kpi; href: string }) {
  switch (k.state) {
    case "error": return <ErrorState message="Couldn't load this number" referenceId={`home-${k.id}`} href={href} />;
    case "not-available": return <><p className="font-medium">{NOT_AVAILABLE}</p><p className={MUTED}>{whyHidden("not_available")}</p></>;
    case "no-data": return <p className="font-medium">{k.noData}</p>;
    case "suppressed": return <p className={BIG}><SuppressedCell /></p>;
    default: return (
      <>
        <p className={BIG}><span aria-hidden>{k.value}</span><span className="sr-only">{k.valueText}</span></p>
        {k.points.some((p) => p.value != null) ? <Sparkline points={k.points} noun={k.noun} unit={k.unit} goodWhen={k.goodWhen} /> : null}
      </>
    );
  }
}
/** DS-10a KPI cards: label (the title opens its explain card) → direction chip in words → numeral with unit → source line. The hatch is only ever 1 ≤ n < 11. */
export function HomeTiles({ cards, period, href }: { cards: Kpi[]; period: string; href: string }) {
  return (
    <Grid cols={3}>
      {cards.map((k) => {
        const live = k.state !== "error" && k.state !== "not-available", titleId = `home-${k.id}-title`;
        const hidden = k.state === "suppressed" ? whyHidden("suppressed") : k.state === "not-available" ? whyHidden("not_available") : k.state === "error" ? whyHidden("error") : undefined;
        return (
          <section key={k.id} aria-labelledby={titleId} data-slot="home-tile" data-metric={k.id} data-state={k.state}>
            <Card className="h-full gap-4">
              <CardHeader className="gap-3">
                <CardTitle><h2 id={titleId} className="font-sans text-sm font-medium leading-snug text-muted-foreground">
                  <ExplainCard term={k.id} value={k.value ?? undefined} source={live ? FAS : undefined} asOf={live ? k.asOf : undefined} hidden={hidden}>{k.title}</ExplainCard>
                </h2></CardTitle>
                {k.chip ? <p data-slot="direction" data-tone={k.chip.tone}><Hint text={k.chip.hint} className="rounded-full"><Badge variant={TONE[k.chip.tone]} prefix={<span aria-hidden>{k.chip.glyph}</span>}>{k.chip.text}</Badge></Hint></p> : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Body k={k} href={href} />
                {live ? <SourceFooter source={FAS} period={quarterLabel(period)} n={`= ${k.n}`} asOf={k.asOf} /> : null}
              </CardContent>
            </Card>
          </section>
        );
      })}
    </Grid>
  );
}
