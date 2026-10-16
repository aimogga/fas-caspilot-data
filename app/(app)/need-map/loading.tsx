import { PageSkeleton } from "@/components/status/PageSkeleton";

/** County need map while the server renders: the map card, then the ranked list or table. */
export default function Loading() {
  return <PageSkeleton page="the county need map" blocks={[{ cols: 1, h: "h-96" }, { cols: 1, h: "h-80" }]} />;
}
