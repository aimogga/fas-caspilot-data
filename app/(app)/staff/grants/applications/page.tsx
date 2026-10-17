import { randomUUID } from "node:crypto";
import { Archive, Check, FileText, PencilLine } from "lucide-react";
import { EmptyState, ErrorState, PageHeader, ResponsiveTable, Stack } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { countWords, listApplications, STATUS_WORDS, type ApplicationListItem } from "@/lib/application/list";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const BADGE = { DRAFT: ["warning", <PencilLine key="d" aria-hidden />], approved: ["success", <Check key="a" aria-hidden />], archived: ["muted", <Archive key="x" aria-hidden />] } as const;
/** Below 768 the table stacks and its header hides, so each cell names itself. */
const Cue = ({ children }: { children: string }) => <span className="text-muted-foreground md:hidden">{children} </span>;

/** F-508k: every application draft in one place, newest first; staff/admin only (`/staff` prefix guard), rows under the caller's RLS. */
export default async function ApplicationsPage() {
  let items: ApplicationListItem[] | null = null, errorId: string | undefined;
  try {
    const client = await createClient();
    items = client ? await listApplications(client) : [];
  } catch (e) {
    errorId = randomUUID();
    console.error("[applications] list failed", { referenceId: errorId, message: e instanceof Error ? e.message : "unknown" });
  }
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="GRANTS" title="Applications" description="Every application written from an approved strategy, newest first. Open one to edit, approve or download it." />
      {items === null ? <ErrorState message="Couldn't load the applications" referenceId={errorId ?? randomUUID()} href="/staff/grants/applications">Something went wrong on our side. Try again.</ErrorState>
        : items.length === 0 ? (
          <EmptyState icon={<FileText aria-hidden className="size-6 text-muted-foreground" />} title="No applications yet"
            action={<a href="/staff/grants/matches" className={buttonVariants({ variant: "outline" })}>Go to Grant matches</a>}>
            Pick a match, draft a response strategy, approve it, then choose Write the application. It will show up here.
          </EmptyState>
        ) : (
          <Stack gap={3}>
            <p data-slot="application-counts" className="text-sm text-muted-foreground">{countWords(items)}</p>
            <ResponsiveTable stack>
              <thead><tr><th scope="col">Grant</th><th scope="col">Status</th><th scope="col">Started</th><th scope="col">Approved</th></tr></thead>
              <tbody data-slot="application-list">
                {items.map((a) => (
                  <tr key={a.id} data-application={a.id}>
                    <td><a href={`/staff/grants/applications/${a.id}`} className="font-medium underline underline-offset-4">{a.title}</a>{a.funder ? <span className="block text-sm text-muted-foreground">{a.funder}</span> : null}</td>
                    <td><Badge variant={BADGE[a.status][0]} prefix={BADGE[a.status][1]}>{STATUS_WORDS[a.status]}</Badge></td>
                    <td><Cue>Started</Cue>{a.started}</td>
                    <td><Cue>Approved</Cue>{a.approved ?? <span className="text-muted-foreground">Not yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          </Stack>
        )}
    </Stack>
  );
}
