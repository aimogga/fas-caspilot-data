import { randomUUID } from "node:crypto";
import "@/components/board/print.css";
import { PrintButton } from "@/components/board/PrintButton";
import { ErrorState, FormField, PageHeader, Stack } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { ALL, type SearchParams } from "@/lib/dashboard/filters";
import { PacketView } from "@/components/packets/PacketView";
import { VARIANT_LABEL, type Packet } from "@/lib/packets/model";
import { PacketQuery, parsePacketParams } from "@/lib/packets/query";
import { createClient } from "@/lib/supabase/server";
import { COUNTIES } from "@/lib/synthetic/generate";

export const dynamic = "force-dynamic";
const SELECT = "h-12 lg:h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs dark:bg-input/30";
const opt = (value: string, label: string) => <option key={value} value={value}>{label}</option>;
/** F-404: plain links to the export route (DOCX or CSV appendix) for the current variant and county; hidden in print with the other controls. */
const download = (variant: string, county: string | undefined, format: "docx" | "csv", label: string) => (
  <a data-slot="packet-download" className={buttonVariants({ variant: "outline" })} href={`/api/packets/export?variant=${variant}&county=${county ?? ""}&format=${format}`}>{label}</a>
);

/** F-403 part 1: print-ready evidence packet. The browser's Print → Save as PDF makes the PDF; staff/admin only (`/staff` prefix guard). */
export default async function PacketsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const now = new Date(), { variant, scope } = parsePacketParams(await searchParams);
  // The board packet is always statewide (scopeLabel), so the County menu only shows for the grant attachment.
  const county = variant === "grant" ? scope.county : undefined;
  let packet: Packet | null = null, errorId: string | undefined;
  try {
    const client = await createClient(), user = client ? (await client.auth.getUser()).data.user : null;
    const meta = user?.app_metadata ?? {}, staff = meta.role === "admin" || meta.role === "staff";
    const actor = user && staff && typeof meta.org_id === "string" ? { userId: user.id, orgId: meta.org_id } : null;
    packet = client ? await PacketQuery.load(client, variant, scope, now, actor) : null;
  } catch (e) {
    errorId = randomUUID();
    console.error("[packets] load failed", { referenceId: errorId, message: e instanceof Error ? e.message : "unknown", stack: e instanceof Error ? e.stack : undefined });
  }
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Evidence packets" description="A print-ready packet of suppressed aggregates with sources and dates. Use Print / Save as PDF to produce the file." />
      <form method="get" action="/staff/packets" data-slot="packet-controls" className="flex flex-wrap items-end gap-3">
        <FormField label="Variant" htmlFor="variant"><select id="variant" name="variant" defaultValue={variant} className={SELECT}>{(Object.keys(VARIANT_LABEL) as (keyof typeof VARIANT_LABEL)[]).map((v) => opt(v, VARIANT_LABEL[v]))}</select></FormField>
        {variant === "grant" ? <FormField label="County" htmlFor="county"><select id="county" name="county" defaultValue={county ?? ALL} className={SELECT}>{[opt(ALL, "Statewide"), ...COUNTIES.map((c) => opt(c.fips, c.name))]}</select></FormField> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={buttonVariants()}>Update</button><PrintButton label="Print / Save as PDF" />
          {download(variant, county, "docx", "Download Word (.docx)")}{download(variant, county, "csv", "Download CSV appendix")}
        </div>
      </form>
      {packet ? <PacketView packet={packet} /> : <ErrorState message="Couldn't build the packet" referenceId={errorId ?? randomUUID()} href="/staff/packets">Something went wrong on our side. Try again.</ErrorState>}
    </Stack>
  );
}
