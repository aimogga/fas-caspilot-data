import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Board summary while the server renders: the three-KPI rule row, the picture cards, the metric cards. */
export default function Loading() {
  return <PageSkeleton page="the board summary" blocks={[{ cols: 3, h: "h-32" }, { cols: 2, h: "h-80" }, { cols: 3, h: "h-48" }]} />;
}
