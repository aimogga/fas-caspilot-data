import { PageSkeleton } from "@/components/status/PageSkeleton";

/** Upload page while the server reads the county list and the batch list: the wizard card, then the Recent uploads table. */
export default function Loading() {
  return <PageSkeleton page="the upload page" blocks={[{ cols: 1, h: "h-72" }, { cols: 1, h: "h-48" }]} />;
}
