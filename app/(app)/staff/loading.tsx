import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Staff and admin home while the server renders: greeting, three KPI cards, the "Needs you" list beside the chart, the public-sources card. */
export default function Loading() {
  return <PageSkeleton page="your home" blocks={[{ cols: 3, h: "h-40" }, { cols: 2, h: "h-80" }, { cols: 1, h: "h-48" }]} />;
}
