import { LineChart } from "@/components/charts/LineChart";
import { Grid } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { quarterLabel } from "@/lib/dashboard/filters";
import type { DashboardMetrics } from "@/lib/dashboard/metrics-query";
import { dashboardTrends } from "@/lib/dashboard/trends";
/** The last four quarters of M2, M3 and M5 as line charts under their cards, each with the same FAS records footer. Renders nothing when no metric has a known quarter. */
export function TrendPictures({ metrics, period }: { metrics: DashboardMetrics | null; period: string }) {
  const list = dashboardTrends(metrics);
  if (!list.length) return null;
  return (
    <section data-slot="dashboard-trends" aria-label="The last four quarters">
      <Grid cols={3}>
        {list.map(({ id, n, asOf, ...p }) => (
          <Card key={id} data-trend={id} className="h-full">
            <CardContent><LineChart {...p} footer={{ source: "FAS records", period: quarterLabel(period), n: `= ${n}`, asOf }} periodHead="Quarter" /></CardContent>
          </Card>
        ))}
      </Grid>
    </section>
  );
}
