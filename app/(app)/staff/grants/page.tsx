import { PencilLine } from "lucide-react";
import { EmptyState, Grid, PageHeader, Section, Stack } from "@/components/layout";
import { FoundationForm } from "@/components/grants/FoundationForm";
import { FoundationImport } from "@/components/grants/FoundationImport";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Recent = { id: string; title: string; funder: string | null; close_date: string | null; award_floor: number | null; award_ceiling: number | null }; const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
/** Public opportunity dates may show the day (DS-07 trust rules). */
const closes = (d: string | null) => (d ? `Closes ${new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : "No close date");
const award = (o: Recent) => (o.award_floor !== null && o.award_ceiling !== null ? `${usd(o.award_floor)}–${usd(o.award_ceiling)}` : o.award_ceiling !== null ? `Up to ${usd(o.award_ceiling)}` : o.award_floor !== null ? `From ${usd(o.award_floor)}` : "Award not stated");

export default async function FoundationGrantsPage() {
  const client = await createClient();
  const q = client?.from("opportunity").select("id,title,funder,close_date,award_floor,award_ceiling").like("source", "foundation%").order("raw->>imported_at", { ascending: false }).order("close_date", { ascending: false, nullsFirst: false }).limit(10);
  const { data, error } = q ? await q : { data: null, error: { message: "no client" } }, recent = (data ?? []) as Recent[];
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Foundation grants" description="Add a foundation opportunity by hand or import a list. Federal opportunities arrive on their own from Grants.gov." />
      <Grid cols={2}><FoundationForm /><FoundationImport /></Grid>
      <Section title="Recent foundation opportunities">
        {error ? <EmptyState title="Couldn't load recent opportunities" headingLevel="h3">Something went wrong loading the list. Reload the page to try again.</EmptyState>
          : recent.length === 0 ? <EmptyState title="No foundation opportunities yet" headingLevel="h3">Entries you add or import appear here.</EmptyState> : (
          <ul data-slot="recent-opportunities" className="flex flex-col divide-y rounded-xl border bg-card">
            {recent.map((o) => <li key={o.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{o.title}</span><Badge prefix={<PencilLine aria-hidden />}>Manual entry</Badge></div>
              <p className="text-muted-foreground">{o.funder ?? "Funder not stated"} · {closes(o.close_date)} · <span className="tabular-nums">{award(o)}</span></p>
            </li>)}
          </ul>
        )}
      </Section>
    </Stack>
  );
}
