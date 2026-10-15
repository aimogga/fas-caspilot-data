import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Grid } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { boardPictures } from "@/lib/board/pictures";
import { quarterLabel } from "@/lib/dashboard/filters";
import type { DashboardMetrics } from "@/lib/dashboard/metrics-query";
/** F-402 "four pictures": the quarter's story as charts first, each in its own card with the same source footer as the metric cards. Renders nothing when no metric loaded. */
export function Pictures({ metrics, period }: { metrics: DashboardMetrics | null; period: string }) {
  const list = boardPictures(metrics);
  if (!list.length) return null;
  return (
    <section data-slot="board-pictures" aria-label="This quarter in pictures">
      <Grid cols={2}>
        {list.map(({ id, kind, n, asOf, ...p }) => {
          const footer = { source: "FAS records", period: quarterLabel(period), n: `= ${n}`, asOf };
          return (
            <Card key={id} data-picture={id} className="h-full">
              <CardContent>{kind === "line" ? <LineChart {...p} footer={footer} periodHead="Quarter" /> : <BarChart {...p} footer={footer} />}</CardContent>
            </Card>
          );
        })}
      </Grid>
    </section>
  );
}
