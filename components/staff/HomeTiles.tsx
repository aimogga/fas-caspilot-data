import { Sparkline } from "@/components/charts/Sparkline";
import { Grid } from "@/components/layout";
import { SourceFooter, SuppressedCell } from "@/components/trust";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { quarterLabel } from "@/lib/dashboard/filters";
import type { Tile } from "@/lib/staff/home";
/** Four headline tiles for the staff home: the number, its four-quarter sparkline with a Better/Worse word, the prior-quarter delta and the source footer (no inline links: every tap target on the page stays ≥ 44px). */
export function HomeTiles({ tiles, period }: { tiles: Tile[]; period: string }) {
  return (
    <Grid cols={4} className="md:grid-cols-2">
      {tiles.map((t) => (
        <Card key={t.id} data-slot="home-tile" data-metric={t.id} data-state={t.error ? "error" : t.value == null ? "suppressed" : "value"} className="h-full">
          <CardHeader><CardTitle><h2 className="text-sm font-semibold">{t.title}</h2></CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {t.error ? <p className="text-sm text-muted-foreground">Couldn&apos;t load this number</p> : <>
              <p className="text-[2rem] leading-none font-semibold tabular-nums">{t.value ?? <SuppressedCell />}</p>
              {t.points.some((p) => p.value != null) ? <Sparkline points={t.points} noun={t.noun} unit={t.unit} goodWhen={t.goodWhen} /> : null}
              {t.delta ? <p data-slot="delta" className="text-sm font-medium">{t.delta}</p> : null}
              <SourceFooter source="FAS records" period={quarterLabel(period)} n={`= ${t.n}`} asOf={t.asOf} />
            </>}
          </CardContent>
        </Card>
      ))}
    </Grid>
  );
}
