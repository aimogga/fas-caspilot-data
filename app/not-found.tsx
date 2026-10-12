import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusCard } from "@/components/status/StatusCard";
import { getViewer, StatusFrame } from "@/components/status/StatusFrame";
import { homeLabel } from "@/lib/status";

export default async function NotFound() {
  const viewer = await getViewer();
  const href = viewer.home ?? "/login";
  const label = viewer.home ? `Go to ${homeLabel(viewer.role)}` : "Go to sign in";
  return (
    <StatusFrame viewer={viewer}>
      <StatusCard
        icon={<SearchX />}
        eyebrow="Error 404 · Not found"
        title="We can't find that page"
        actions={<Link data-slot="button" className={buttonVariants()} href={href}>{label}</Link>}
      >
        <p>The address may be mistyped, or the page may have moved.</p>
      </StatusCard>
    </StatusFrame>
  );
}
