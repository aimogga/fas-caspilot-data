import { randomUUID } from "node:crypto";
import { UploadWizard } from "@/components/intake/UploadWizard";
import { ErrorState, PageHeader, Stack } from "@/components/layout";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const DESCRIPTION = "CSV only for now. Download a template, fill it in, upload it, map the columns and check the preview before anything is saved.";

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

export default async function IntakePage() {
  const countyFips = await loadCountyFips();
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Upload data" description={DESCRIPTION} />
      {countyFips && countyFips.length ? (
        <UploadWizard countyFips={countyFips} />
      ) : (
        <ErrorState message="Couldn't load the county list" referenceId={randomUUID()} href="/staff/intake">County codes are needed to check uploads. Try again.</ErrorState>
      )}
    </Stack>
  );
}
