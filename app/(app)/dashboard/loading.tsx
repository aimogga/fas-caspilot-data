import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Team dashboard while the server renders: three metric cards, two picture cards, two wide cards, the freshness and pipeline widgets. */
export default function Loading() {
  return <PageSkeleton page="the team dashboard" blocks={[{ cols: 3, h: "h-48" }, { cols: 2, h: "h-80" }, { cols: 2, h: "h-64" }, { cols: 2, h: "h-48" }]} />;
}
