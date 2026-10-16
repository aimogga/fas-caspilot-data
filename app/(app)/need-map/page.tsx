import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Cluster, EmptyState, ErrorState, PageHeader, Stack } from "@/components/layout";
import { FasFilter } from "@/components/need-map/FasFilter";
import { MapSelect } from "@/components/need-map/MapSelect";
import { NeedMap } from "@/components/need-map/NeedMap";
import { NeedTable } from "@/components/need-map/NeedTable";
import { RankedList } from "@/components/need-map/RankedList";
import { NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Target look (visual-direction.md): a serif question, then one plain sentence. The measure count is not named because the columns come from whatever sources have loaded.
const DESCRIPTION = "Each county is ranked against the other 28 on public measures such as poverty and uninsured rates. Darker means more need. Pick a county to see why it ranks where it does.";

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
  const actions = <Cluster gap={3}><Link href="/methodology" data-slot="button" className={buttonVariants({ variant: "outline" })}>Methodology</Link><FasFilter /></Cluster>;
  return (
    <Stack gap={6}>
      <PageHeader eyebrow={NeedMapQuery.eyebrow(role)} title="Where is the need greatest?" description={DESCRIPTION} actions={actions} />
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
          {/* Below md: the ranked list; from md: the table. Both are in the DOM; CSS shows one (DS-11b). */}
          <RankedList data={data} fas={fas} />
          <NeedTable data={data} fas={fas} />
          <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{data.footer}</p>
        </>
      )}
    </Stack>
  );
}
