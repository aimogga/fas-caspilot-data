import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Grant matches while the server renders: one row per opportunity card. */
export default function Loading() {
  return <PageSkeleton page="grant matches" blocks={[{ cols: 1, h: "h-28", n: 5 }]} />;
}
