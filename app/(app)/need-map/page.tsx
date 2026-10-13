import { randomUUID } from "node:crypto";
import { EmptyState, ErrorState, PageHeader, Stack } from "@/components/layout";
import { NeedTable } from "@/components/need-map/NeedTable";
import { NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NeedMapPage() {
  const client = await createClient();
  const role = client ? (await client.auth.getUser()).data.user?.app_metadata?.role : null;
  let data: NeedTableData | null = null;
  try {
    data = client ? await NeedMapQuery.load(client) : null;
  } catch (e) {
    console.error("[need-map] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  return (
    <Stack gap={6}>
      <PageHeader eyebrow={NeedMapQuery.eyebrow(role)} title="County need map" description="Relative need across Utah's 29 counties, from public data." />
      {data === null ? (
        <ErrorState message="Couldn't load the need map" referenceId={randomUUID()} href="/need-map">Something went wrong loading county data. Try again.</ErrorState>
      ) : !data.hasData ? (
        <EmptyState title="No public data loaded yet">County numbers appear after the first public data source finishes loading.</EmptyState>
      ) : (
        <>
          {data.version === null ? <EmptyState title="Need score not computed yet">Rank and score appear once an admin approves a need-score version. County indicators are still in the table.</EmptyState> : null}
          <NeedTable data={data} />
          <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{data.footer}</p>
        </>
      )}
    </Stack>
  );
}
