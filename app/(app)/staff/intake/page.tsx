import { randomUUID } from "node:crypto";
import { BatchList, type BatchRow } from "@/components/intake/BatchList";
import { UploadWizard } from "@/components/intake/UploadWizard";
import { ErrorState, PageHeader, Stack } from "@/components/layout";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const DESCRIPTION = "CSV only for now. Download a template, fill it in, upload it, match the columns and check the preview. Nothing is saved until you choose Save.";

/** F-301 part 2: county codes come from `geo_county` so the browser-side validation matches the database. */
async function loadCountyFips(): Promise<string[] | null> {
  try {
    const client = await createClient();
    const res = client ? await client.from("geo_county").select("fips").eq("state", "UT") : null;
    if (!res || res.error) throw new Error(res?.error?.message ?? "no Supabase client");
    return (res.data as { fips: string }[]).map((r) => r.fips);
  } catch (e) {
    console.error("[staff/intake] county list failed", { message: e instanceof Error ? e.message : "unknown" });
    return null;
  }
}

/** Newest 20 batches of the caller's org under RLS; an empty list on any failure keeps the wizard usable. */
async function loadBatches(): Promise<BatchRow[]> {
  const client = await createClient();
  const res = client ? await client.from("upload_batch").select("id, created_at, entity, rows_ok, status").order("created_at", { ascending: false }).limit(20) : null;
  if (res?.error) console.error("[staff/intake] batch list failed", { message: res.error.message });
  return (res?.data as BatchRow[] | null) ?? [];
}

export default async function IntakePage() {
  const [countyFips, batches] = await Promise.all([loadCountyFips(), loadBatches()]);
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Add FAS records from a spreadsheet" description={DESCRIPTION} />
      {countyFips && countyFips.length ? (
        <UploadWizard countyFips={countyFips} />
      ) : (
        <ErrorState message="Couldn't load the county list" referenceId={randomUUID()} href="/staff/intake">County codes are needed to check uploads. Try again.</ErrorState>
      )}
      <BatchList batches={batches} />
    </Stack>
  );
}
