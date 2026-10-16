import { randomUUID } from "node:crypto";
import { MatchList } from "@/components/grants/MatchList";
import { EmptyState, ErrorState, PageHeader, Section, Stack } from "@/components/layout";
import { SourceFooter } from "@/components/trust";
import { NOT_AVAILABLE } from "@/lib/dashboard/cards";
import { MatchQuery, type MatchList as MatchData } from "@/lib/grants/match-query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GrantMatchesPage() {
  const client = await createClient();
  const orgId = client ? (await client.auth.getUser()).data.user?.app_metadata?.org_id : null;
  const data: MatchData | null = client && typeof orgId === "string" ? await MatchQuery.list(client, orgId, new Date()).catch((e: unknown) => { console.error("[grant-matches] load failed", { message: e instanceof Error ? e.message : "unknown" }); return null; }) : null;
  const rules = data?.config ? `${data.config.id}${data.config.draft ? " DRAFT" : ""}` : null;
  const description = rules ? `Scored against the ${rules} rules · ${data?.rows.length ?? 0} open opportunities${data?.asOf ? ` · as of ${data.asOf}` : ""}` : "Fit scores for open grant opportunities, with the reasons behind each one.";
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Grant matches" description={description} />
      {data === null ? <ErrorState message="Couldn't load grant matches" referenceId={randomUUID()} href="/staff/grants/matches">Something went wrong loading stored matches. Try again.</ErrorState>
        : data.config === null ? <EmptyState title="Matching is not switched on yet">An admin approves the matching rules before scores appear.</EmptyState>
        : data.rows.length === 0 ? <EmptyState title="No open opportunities yet">Scores appear after the next opportunity ingest and match run.</EmptyState>
        : <Section title={`${data.rows.length} open ${data.rows.length === 1 ? "opportunity" : "opportunities"}, best fit first`}>
            <MatchList rows={data.rows} asOf={data.asOf ?? undefined} />
            <SourceFooter source="Grants.gov" period="open opportunities" n={data.rows.length} asOf={data.asOf ?? NOT_AVAILABLE} />
          </Section>}
    </Stack>
  );
}
