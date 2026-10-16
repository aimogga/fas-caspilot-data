import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Methodology while the server reads the approved version: the version strip, the formula, the inputs table, then the weight cards. */
export default function Loading() {
  return <PageSkeleton page="the need score methodology" blocks={[{ cols: 1, h: "h-6" }, { cols: 1, h: "h-48" }, { cols: 1, h: "h-64" }, { cols: 3, h: "h-32" }]} />;
}
