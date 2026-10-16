import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Enter data while the server loads the county list: the "What are you adding?" selector, then one form-tall block. */
export default function Loading() {
  return <PageSkeleton page="the entry form" blocks={[{ cols: 1, h: "h-20" }, { cols: 1, h: "h-96" }]} />;
}
