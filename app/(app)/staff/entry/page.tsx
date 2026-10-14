import { randomUUID } from "node:crypto";
import { AggregateForm } from "@/components/intake/AggregateForm";
import { EntryForm } from "@/components/intake/EntryForm";
import { ErrorState, PageHeader, Stack } from "@/components/layout";
import type { AggregateRecent } from "@/lib/intake/aggregate";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const DESCRIPTION = "Add one record at a time. The same checks run as for uploads.";

/** F-302: county names and codes come from `geo_county` so the select and the validator agree. */
async function loadCounties(): Promise<{ fips: string; name: string }[] | null> {
  try {
    const client = await createClient();
    const res = client ? await client.from("geo_county").select("fips,name").eq("state", "UT").order("name") : null;
    if (!res || res.error) throw new Error(res?.error?.message ?? "no Supabase client");
    return res.data as { fips: string; name: string }[];
  } catch (e) {
    console.error("[staff/entry] county list failed", { message: e instanceof Error ? e.message : "unknown" });
    return null;
  }
}

/** F-303: newest 10 aggregate totals in the caller's org (RLS); an empty list on failure keeps the form usable. */
async function loadRecentAggregates(): Promise<AggregateRecent[]> {
  try {
    const client = await createClient();
    const res = client ? await client.from("aggregate_submission").select("id,period,metric_code,value,county_fips").order("created_at", { ascending: false }).limit(10) : null;
    if (!res || res.error) throw new Error(res?.error?.message ?? "no Supabase client");
    return res.data as AggregateRecent[];
  } catch (e) {
    console.error("[staff/entry] recent aggregates failed", { message: e instanceof Error ? e.message : "unknown" });
    return [];
  }
}

export default async function EntryPage() {
  const [counties, recent] = await Promise.all([loadCounties(), loadRecentAggregates()]);
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Enter data" description={DESCRIPTION} />
      {counties && counties.length ? (
        <EntryForm counties={counties} aggregate={<AggregateForm counties={counties} recent={recent} />} />
      ) : (
        <ErrorState message="Couldn't load the county list" referenceId={randomUUID()} href="/staff/entry">County codes are needed to check records. Try again.</ErrorState>
      )}
    </Stack>
  );
}
