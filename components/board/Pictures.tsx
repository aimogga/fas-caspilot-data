import { PictureCards } from "@/components/charts/PictureCards";
import { boardPictures } from "@/lib/board/pictures";
import type { DashboardMetrics } from "@/lib/dashboard/metrics-query";
/** F-402 "four pictures": the quarter's story as charts first, each in its own card with the same source footer as the metric cards. Renders nothing when no metric loaded. */
export function Pictures({ metrics, period }: { metrics: DashboardMetrics | null; period: string }) {
  const list = boardPictures(metrics);
  if (!list.length) return null;
  return (
    <section data-slot="board-pictures" aria-label="This quarter in pictures">
      <PictureCards pictures={list} period={period} />
    </section>
  );
}
