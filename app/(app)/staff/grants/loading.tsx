import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Foundation grants while the server loads the recent list: the form and import cards side by side, then one bar per recent grant. */
export default function Loading() {
  return <PageSkeleton page="foundation grants" blocks={[{ cols: 2, h: "h-96" }, { cols: 1, h: "h-16", n: 4 }]} />;
}
