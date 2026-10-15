import { PictureCards } from "@/components/charts/PictureCards";
import type { DashboardMetrics } from "@/lib/dashboard/metrics-query";
import { dashboardTrends } from "@/lib/dashboard/trends";
/** The last four quarters of M2, M3 and M5 as line charts under their cards, each with the same FAS records footer. Renders nothing when no metric has a known quarter. */
export function TrendPictures({ metrics, period }: { metrics: DashboardMetrics | null; period: string }) {
  const list = dashboardTrends(metrics);
  if (!list.length) return null;
  return (
    <section data-slot="dashboard-trends" aria-label="The last four quarters">
      <PictureCards pictures={list} period={period} cols={3} />
    </section>
  );
}
