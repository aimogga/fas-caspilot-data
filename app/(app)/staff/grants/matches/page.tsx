import { randomUUID } from "node:crypto";
import { MatchTable } from "@/components/grants/MatchPanel";
import { EmptyState, ErrorState, PageHeader, Stack } from "@/components/layout";
import { MatchQuery, type MatchList } from "@/lib/grants/match-query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GrantMatchesPage() {
  const client = await createClient();
  const orgId = client ? (await client.auth.getUser()).data.user?.app_metadata?.org_id : null;
  const data: MatchList | null = client && typeof orgId === "string" ? await MatchQuery.list(client, orgId, new Date()).catch((e: unknown) => { console.error("[grant-matches] load failed", { message: e instanceof Error ? e.message : "unknown" }); return null; }) : null;
  const rules = data?.config ? `${data.config.id}${data.config.draft ? " DRAFT" : ""}` : null;
  const description = rules ? `Scored against the ${rules} rules · ${data?.rows.length ?? 0} open opportunities${data?.asOf ? ` · as of ${data.asOf}` : ""}` : "Fit scores for open grant opportunities, with the reasons behind each one.";
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Grant matches" description={description} />
      {data === null ? <ErrorState message="Couldn't load grant matches" referenceId={randomUUID()} href="/staff/grants/matches">Something went wrong loading stored matches. Try again.</ErrorState>
        : data.config === null ? <EmptyState title="Matching is not switched on yet">An admin approves the matching rules before scores appear.</EmptyState>
        : data.rows.length === 0 ? <EmptyState title="No open opportunities yet">Scores appear after the next opportunity ingest and match run.</EmptyState>
        : <MatchTable rows={data.rows} />}
    </Stack>
  );
}
