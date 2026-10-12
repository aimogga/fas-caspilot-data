import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isDevGalleryEnabled } from "@/lib/dev-gallery";

export default function HealthLayout({ children }: { children: ReactNode }) {
  if (!isDevGalleryEnabled()) notFound();
  return children;
}
