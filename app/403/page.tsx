import Link from "next/link";
import { Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusCard } from "@/components/status/StatusCard";
import { getViewer, StatusFrame } from "@/components/status/StatusFrame";
import { roleLabel } from "@/lib/shell/nav";
import { areaName, homeLabel, requestedPath } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function ForbiddenPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const viewer = await getViewer();
  const from = requestedPath((await searchParams).from);
  if (viewer.signedIn && !viewer.role) {
    return (
      <StatusFrame viewer={viewer}>
        <StatusCard
          icon={<Lock />}
          eyebrow="Error 403 · Account not set up"
          title="Your account isn't set up yet"
          actions={<form action="/api/auth/signout" method="post"><Button type="submit" variant="outline">Sign out</Button></form>}
        >
          <p>You&apos;re signed in, but your account doesn&apos;t have a role yet.</p>
          <p data-slot="status-guidance">Ask your FAS admin to set up your role.</p>
        </StatusCard>
      </StatusFrame>
    );
  }
  const href = viewer.home ?? "/login";
  const label = viewer.home ? `Go to ${homeLabel(viewer.role)}` : "Go to sign in";
  return (
    <StatusFrame viewer={viewer}>
      <StatusCard
        icon={<Lock />}
        eyebrow="Error 403 · No permission"
        title={`You don't have access to ${areaName(from)}`}
        actions={<Link data-slot="button" className={buttonVariants()} href={href}>{label}</Link>}
        footnote={from ? <>Requested path: <code>{from}</code></> : null}
      >
        {viewer.role ? <p>You&apos;re signed in as {roleLabel(viewer.role)}.</p> : null}
        <p data-slot="status-guidance">Ask your FAS admin to change your role.</p>
      </StatusCard>
    </StatusFrame>
  );
}
