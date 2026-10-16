import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Evidence packets while the server builds the packet: the controls row, the cover card, then the first section's figure tiles. */
export default function Loading() {
  return <PageSkeleton page="the evidence packet" blocks={[{ cols: 1, h: "h-12" }, { cols: 1, h: "h-56" }, { cols: 3, h: "h-28" }]} />;
}
