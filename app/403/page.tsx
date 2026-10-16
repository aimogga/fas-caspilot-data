import Link from "next/link";
import { Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusCard } from "@/components/status/StatusCard";
import { getViewer, StatusFrame } from "@/components/status/StatusFrame";
import { Hint } from "@/components/trust/explain";
import { roleLabel } from "@/lib/shell/nav";
import { areaName, homeLabel, requestedPath } from "@/lib/status";

export const dynamic = "force-dynamic";

/** One line on the role name: what a role is and who changes it. No claim of logging: nothing writes an audit row on a 403. */
const roleHint = (label: string): string => `${label} is the role on your account. It decides which areas you can open; an FAS admin can change it.`;
/** Role names in words for this page; the nav keeps its short labels. */
const ROLE_WORDS: Record<string, string> = { admin: "FAS admin", staff: "Staff member", board_viewer: "Board member" };
const roleWords = (role: string): string => ROLE_WORDS[role] ?? roleLabel(role);
const ROLE = "underline decoration-dotted underline-offset-4";

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
          focusTitle
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
        focusTitle
      >
        {viewer.role ? <p data-slot="status-role">You&apos;re signed in as <Hint text={roleHint(roleWords(viewer.role))} className={ROLE}>{roleWords(viewer.role)}</Hint>.</p> : null}
        <p data-slot="status-guidance">Ask your FAS admin to change your role.</p>
      </StatusCard>
    </StatusFrame>
  );
}
