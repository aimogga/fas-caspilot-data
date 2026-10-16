import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { ApplicationSection } from "@/components/grants/ApplicationSection";
import { Cluster, ErrorState, PageHeader, Section, Stack } from "@/components/layout";
import { Hint } from "@/components/trust/explain";
import { Button } from "@/components/ui/button";
import { HEADER } from "@/lib/application/docx";
import { loadApplication, type LoadedApplication } from "@/lib/application/query";
import { approvalBlockers, PORTAL_NOTE, reviewSection } from "@/lib/application/review";
import { createClient } from "@/lib/supabase/server";
import { approveDraft, newVersion } from "./actions";

export const dynamic = "force-dynamic";
const STATUS = { DRAFT: "Draft, open for edits", approved: "Approved, read-only", archived: "Archived, read-only" } as const;
const DOWNLOAD_OFF = "Word download opens once an admin approves this draft.";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, client = await createClient();
  const role = client ? (await client.auth.getUser()).data.user?.app_metadata?.role : null;
  let app: LoadedApplication | null;
  try { app = client ? await loadApplication(client, id) : null; } catch (e) {
    console.error("[application] load failed", { message: e instanceof Error ? e.message : "unknown" });
    return <ErrorState message="Couldn't load this application" referenceId={randomUUID()} href={`/staff/grants/applications/${id}`}>Something went wrong loading the stored draft. Try again.</ErrorState>;
  }
  if (!app) notFound();
  const { draft, snapshot } = app, facts = new Map(snapshot.facts.map((f) => [f.citation_id, f]));
  const open = draft.status === "DRAFT", approved = draft.status === "approved", blockers = approvalBlockers(draft.sections, snapshot);
  return (
    <Stack gap={6}>
      <div data-slot="draft-banner" role="note" className="sticky top-0 z-10 rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm font-medium">{HEADER}</div>
      <PageHeader eyebrow="GRANT APPLICATION" title={app.title} description={`${STATUS[draft.status]} · ${draft.sections.length} sections under the funder’s headings`} />
      <Section title="Review and approval">
        <Cluster gap={3} className="items-center">
          {open && role === "admin" ? <form action={approveDraft}><input type="hidden" name="id" value={draft.id} /><Button type="submit" disabled={blockers.length > 0}>Approve draft</Button></form> : null}
          {open && role !== "admin" ? <p className="text-sm text-muted-foreground">An admin approves this draft once every section is ready.</p> : null}
          {!open ? <form action={newVersion}><input type="hidden" name="id" value={draft.id} /><Button type="submit" variant="outline">Start a new version to edit</Button></form> : null}
          {approved ? <Button asChild variant="outline"><a href={`/api/grants/applications/${draft.id}/docx`} download>Download Word</a></Button>
            : <Hint text={DOWNLOAD_OFF}><span data-slot="download-off" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm text-muted-foreground" aria-disabled="true">Download Word</span></Hint>}
        </Cluster>
        {open && blockers.length ? <ul data-slot="blockers" aria-label="Before approval" className="list-disc pl-5 text-sm">{blockers.map((b) => <li key={b}>{b}</li>)}</ul> : null}
      </Section>
      <Section title="Sections">
        <ol data-slot="application-sections" className="flex flex-col gap-6">
          {draft.sections.map((s) => <ApplicationSection key={s.key} draftId={draft.id} section={s} review={reviewSection(s, snapshot)} facts={facts} editable={open} />)}
        </ol>
      </Section>
      <p data-slot="portal-note" className="border-t border-border pt-4 text-xs text-muted-foreground">{PORTAL_NOTE}</p>
    </Stack>
  );
}
