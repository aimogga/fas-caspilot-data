import { randomUUID } from "node:crypto";
import { EmptyState, ErrorState, PageHeader, Stack } from "@/components/layout";
import { DataFreshnessTable, FreshnessSummary } from "@/components/freshness/DataFreshnessTable";
import { FreshnessPage, type FreshnessPageView } from "@/lib/freshness/query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const DESCRIPTION = "Latest vintage, last successful run, and status for each public data source.";

export default async function DataFreshnessPage() {
  const now = new Date();
  let role: string | undefined;
  let view: FreshnessPageView | undefined;
  try {
    const client = await createClient();
    role = client ? (await client.auth.getUser()).data.user?.app_metadata?.role : undefined;
    view = client ? await FreshnessPage.load(client, now, role) : undefined;
  } catch (e) {
    console.error("[data-freshness] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Data freshness" description={view && view.rows.length ? <FreshnessSummary view={view} /> : DESCRIPTION} />
      {!view ? (
        <ErrorState message="Couldn't load data freshness" referenceId={randomUUID()} href="/data-freshness">Something went wrong loading the source list. Try again.</ErrorState>
      ) : view.rows.length === 0 ? (
        <EmptyState title="No sources registered yet" action={role === "staff" ? <p className="text-sm text-muted-foreground">Ask an admin to register sources.</p> : undefined}>
          Public data sources will appear here after the source registry is set up.
        </EmptyState>
      ) : (
        <DataFreshnessTable view={view} />
      )}
    </Stack>
  );
}
