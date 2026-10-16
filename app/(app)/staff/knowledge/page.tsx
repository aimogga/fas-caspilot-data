import { randomUUID } from "node:crypto";
import { KnowledgeList } from "@/components/knowledge/KnowledgeList";
import { EmptyState, ErrorState, PageHeader, Stack } from "@/components/layout";
import { loadPage } from "@/lib/knowledge/load";

export const dynamic = "force-dynamic";

/** F-508c: staff read the approved entries only, with no edit controls. RLS already hides drafts and archived rows from staff. */
export default async function KnowledgeStaffPage() {
  const data = await loadPage();
  const rows = (data?.rows ?? []).filter((r) => r.status === "approved").map((r) => ({ ...r, history: r.history.filter((v) => v.status === "approved") }));
  return (
    <Stack gap={8}>
      <PageHeader eyebrow="WORKSPACE" title="What FAS says about itself" description="Approved text the grant writer may quote. An admin adds and approves entries." />
      {!data ? <ErrorState message="Couldn't load FAS knowledge" referenceId={randomUUID()} href="/staff/knowledge">Try again.</ErrorState>
        : rows.length ? <KnowledgeList rows={rows} me={data.me} editable={false} />
        : <EmptyState title="Nothing approved yet">An admin adds the mission, programs, eligibility facts and outcomes, then approves them. Approved entries appear here.</EmptyState>}
    </Stack>
  );
}
