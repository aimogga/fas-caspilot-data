import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Admin home while the server renders: the same shape as the staff home (greeting, three KPI cards, the list beside the chart, the sources card). */
export default function Loading() {
  return <PageSkeleton page="your home" blocks={[{ cols: 3, h: "h-40" }, { cols: 2, h: "h-80" }, { cols: 1, h: "h-48" }]} />;
}
