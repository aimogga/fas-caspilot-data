import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Data freshness while the server reads the source registry: the header with its one-line summary, then the one table card of sources. */
export default function Loading() {
  return <PageSkeleton page="data freshness" blocks={[{ cols: 1, h: "h-80" }]} />;
}
