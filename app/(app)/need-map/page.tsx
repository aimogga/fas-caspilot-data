import { randomUUID } from "node:crypto";
import { EmptyState, ErrorState, PageHeader, Stack } from "@/components/layout";
import { FasFilter } from "@/components/need-map/FasFilter";
import { MapSelect } from "@/components/need-map/MapSelect";
import { NeedMap } from "@/components/need-map/NeedMap";
import { NeedTable } from "@/components/need-map/NeedTable";
import { NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NeedMapPage({ searchParams }: { searchParams: Promise<{ fas?: string; county?: string }> }) {
  const params = await searchParams;
  const fas = params.fas === "1";
  const client = await createClient();
  const role = client ? (await client.auth.getUser()).data.user?.app_metadata?.role : null;
  let data: NeedTableData | null = null;
  try {
    data = client ? await NeedMapQuery.load(client, { fas }) : null;
  } catch (e) {
    console.error("[need-map] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  // `?county=<fips>` selects a county; unknown values are ignored.
  const selected = data?.counties.find((c) => c.fips === params.county) ?? null;
  return (
    <Stack gap={6}>
      <PageHeader eyebrow={NeedMapQuery.eyebrow(role)} title="County need map" description="Relative need across Utah's 29 counties, from public data. Select a county to see its numbers and sources." actions={<FasFilter />} />
      {data === null ? (
        <ErrorState message="Couldn't load the need map" referenceId={randomUUID()} href="/need-map">Something went wrong loading county data. Try again.</ErrorState>
      ) : !data.hasData ? (
        <EmptyState title="No public data loaded yet">County numbers appear after the first public data source finishes loading.</EmptyState>
      ) : fas && data.rows.length === 0 ? (
        <EmptyState title="No FAS counties set">The FAS county list hasn&apos;t been configured yet.</EmptyState>
      ) : (
        <>
          {data.version === null ? (
            <EmptyState title="Need score not computed yet">The map appears once an admin approves a need-score version. County indicators are still in the table.</EmptyState>
          ) : (
            <div data-slot="need-map-card" className="rounded-lg border border-border bg-card p-4 text-card-foreground"><MapSelect><NeedMap data={data} fas={fas} selected={selected} /></MapSelect></div>
          )}
          <NeedTable data={data} fas={fas} />
          <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{data.footer}</p>
        </>
      )}
    </Stack>
  );
}
