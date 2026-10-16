import { randomUUID } from "node:crypto";
import { PencilLine } from "lucide-react";
import { EmptyState, ErrorState, Grid, PageHeader, Section, Stack } from "@/components/layout";
import { FoundationForm } from "@/components/grants/FoundationForm";
import { FoundationImport } from "@/components/grants/FoundationImport";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { Badge } from "@/components/ui/badge";
import { HEADER, RECENT_HEADLINE, RECENT_TERMS, recentCells, recentNote, type Cell, type RecentOpportunity } from "@/lib/grants/form-words";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// DS-22: every value in a row is a reading target for one explain card (pointer, focus, tap); 44 px below 1024.
const TARGET = "inline-flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 lg:min-h-0";
const Target = ({ cell, className = "" }: { cell: Cell; className?: string }) => <span tabIndex={0} data-slot="recent-value" {...cell.attrs} className={`${TARGET} underline decoration-dotted underline-offset-4 ${className}`}>{cell.text}</span>;

/** F-502: the newest 10 foundation opportunities (RLS); null on failure so the page shows an error with a reference. */
async function loadRecent(): Promise<RecentOpportunity[] | null> {
  try {
    const client = await createClient();
    const q = client?.from("opportunity").select("id,title,funder,close_date,award_floor,award_ceiling,source,imported:raw->>imported_at").like("source", "foundation%");
    const res = q ? await q.order("raw->>imported_at", { ascending: false }).order("close_date", { ascending: false, nullsFirst: false }).limit(10) : null;
    if (!res || res.error) throw new Error(res?.error?.message ?? "no Supabase client");
    return res.data as RecentOpportunity[];
  } catch (e) {
    console.error("[staff/grants] recent opportunities failed", { message: e instanceof Error ? e.message : "unknown" });
    return null;
  }
}

function Row({ o }: { o: RecentOpportunity }) {
  const c = recentCells(o);
  return (
    <li data-slot="recent-row" className="flex flex-col gap-1 px-6 py-4 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2"><span className="break-words font-medium">{o.title}</span>
          <span tabIndex={0} data-slot="recent-value" {...c.badge.attrs} className={TARGET}><Badge prefix={<PencilLine aria-hidden />}>{c.badge.text}</Badge></span></div>
        <p className="text-sm text-muted-foreground">{c.funder.attrs["data-term"] ? <Target cell={c.funder} /> : c.funder.text}</p>
      </div>
      <div className="flex flex-wrap gap-x-4 text-sm md:shrink-0 md:flex-col md:items-end md:text-right">
        <Target cell={c.award} className="font-medium tabular-nums" /><Target cell={c.close} className="text-muted-foreground tabular-nums" />
      </div>
    </li>
  );
}

export default async function FoundationGrantsPage() {
  const recent = await loadRecent();
  return (
    <Stack gap={8}>
      <PageHeader eyebrow={HEADER.eyebrow} title={HEADER.title} description={HEADER.description} />
      <Grid cols={2}><FoundationForm /><FoundationImport /></Grid>
      <Section title={RECENT_HEADLINE}>
        {recent === null ? <ErrorState message="Couldn't load the recent grants" referenceId={randomUUID()} href="/staff/grants">The form and the import still work. Try again to see the list.</ErrorState>
          : recent.length === 0 ? <EmptyState title="No foundation grants yet" headingLevel="h3">Grants you add by hand or import appear here, newest first.</EmptyState> : (
          <ExplainLayer terms={RECENT_TERMS} className="flex flex-col gap-3">
            <ul data-slot="recent-opportunities" className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card shadow-sm">{recent.map((o) => <Row key={o.id} o={o} />)}</ul>
            <p data-slot="recent-note" className="max-w-prose text-sm text-muted-foreground">{recentNote(recent.length)}</p>
          </ExplainLayer>
        )}
      </Section>
    </Stack>
  );
}
