import { notFound } from "next/navigation";
import { isDevGalleryEnabled } from "@/lib/dev-gallery";

export const dynamic = "force-dynamic";

export default async function DevErrorPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  if (!isDevGalleryEnabled()) notFound();
  if ((await searchParams).kind === "notfound") notFound();
  throw new Error("Synthetic DS-04 test failure");
}
