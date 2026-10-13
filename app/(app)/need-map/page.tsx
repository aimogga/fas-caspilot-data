import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Cluster, EmptyState, ErrorState, PageHeader, Stack } from "@/components/layout";
import { FasFilter } from "@/components/need-map/FasFilter";
import { NeedTable } from "@/components/need-map/NeedTable";
import { NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NeedMapPage({ searchParams }: { searchParams: Promise<{ fas?: string }> }) {
  const fas = (await searchParams).fas === "1";
  const client = await createClient();
  const role = client ? (await client.auth.getUser()).data.user?.app_metadata?.role : null;
  let data: NeedTableData | null = null;
  try {
    data = client ? await NeedMapQuery.load(client, { fas }) : null;
  } catch (e) {
    console.error("[need-map] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  const actions = <Cluster gap={3}><Link href="/methodology" data-slot="button" className={buttonVariants({ variant: "outline" })}>Methodology</Link><FasFilter /></Cluster>;
  return (
    <Stack gap={6}>
      <PageHeader eyebrow={NeedMapQuery.eyebrow(role)} title="County need map" description="Relative need across Utah's 29 counties, from public data." actions={actions} />
      {data === null ? (
        <ErrorState message="Couldn't load the need map" referenceId={randomUUID()} href="/need-map">Something went wrong loading county data. Try again.</ErrorState>
      ) : !data.hasData ? (
        <EmptyState title="No public data loaded yet">County numbers appear after the first public data source finishes loading.</EmptyState>
      ) : fas && data.rows.length === 0 ? (
        <EmptyState title="No FAS counties set">The FAS county list hasn&apos;t been configured yet.</EmptyState>
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
