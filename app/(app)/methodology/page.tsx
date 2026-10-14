import { randomUUID } from "node:crypto";
import Link from "next/link";
import { EmptyState, ErrorState, PageHeader, Stack } from "@/components/layout";
import { DraftNotice, FormulaBlock, COLS, inputRows, LimitsSection, MethodologyToc, MTable, Sec, TOC, VersionLine, weightRows } from "@/components/methodology";
import { FreshnessChip } from "@/components/trust";
import { buttonVariants } from "@/components/ui/button";
import { MethodologyQuery, type MethodologyView } from "@/lib/methodology/query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const DESCRIPTION = "How the county need score is calculated from public data — inputs, weights, vintages, and what it cannot tell you.";

export default async function MethodologyPage() {
  const client = await createClient();
  const role = client ? (await client.auth.getUser()).data.user?.app_metadata?.role : null;
  let view: MethodologyView | null | undefined;
  try {
    view = client ? await MethodologyQuery.load(client, process.env.NEXT_PUBLIC_ENV) : undefined;
  } catch (e) {
    console.error("[methodology] load failed", { message: e instanceof Error ? e.message : "unknown" });
  }
  const draft = view ? MethodologyQuery.draftFor(view, role) : null;
  return (
    <Stack gap={6}>
      <PageHeader eyebrow={role === "board_viewer" ? "BOARD" : "SHARE"} title="Need score methodology" description={DESCRIPTION} actions={<Link href="/need-map" className={buttonVariants({ variant: "outline" })}>Back to need map</Link>} />
      {view === undefined ? (
        <ErrorState message="Couldn't load methodology" referenceId={randomUUID()} href="/methodology">Something went wrong loading the need-score explanation. Try again.</ErrorState>
      ) : !view ? (
        <EmptyState title="Need score not approved yet">This page appears once an admin approves a need-score version. The need map&apos;s county indicators stay available without a score.</EmptyState>
      ) : (
        <>
          {draft ? <DraftNotice draft={draft} /> : null}
          <VersionLine version={view.version} approvedAtLabel={view.approvedLabel} synthetic={view.synthetic} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
            <MethodologyToc items={TOC} />
            <Stack gap={8}>
              <Sec id="how" title="How we calculate it"><FormulaBlock view={view} /></Sec>
              <Sec id="inputs" title="Inputs"><MTable caption={`Public inputs for need score version ${view.version}`} cols={COLS.input} rows={inputRows(view.inputs)} /></Sec>
              <Sec id="weights" title="Weights">
                <MTable caption={`Weights for version ${view.version}`} cols={COLS.weight} rows={weightRows(view.weights, view.sum)} />
                {view.mismatch ? <p data-slot="weights-mismatch" className="text-sm text-warning">{view.mismatch}</p> : null}
              </Sec>
              <Sec id="vintages" title="Vintages and freshness">
                <p className="text-sm">Each input carries the vintage the source published and the date of our last successful load.</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {view.inputs.map((r) => <li key={r.key} data-vintage={r.key} className="flex flex-wrap items-center gap-2"><span>{r.label}: {r.source} {r.vintage} · as of {r.asOf}</span>{r.status === "current" ? <FreshnessChip status="current" /> : "Not published"}</li>)}
                </ul>
                {view.notPublished ? <p data-slot="not-published-count" className="text-sm text-muted-foreground">{view.notPublished}</p> : null}
              </Sec>
              <Sec id="limits" title="What this score cannot tell you"><LimitsSection /></Sec>
            </Stack>
          </div>
          <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{view.footer}</p>
        </>
      )}
    </Stack>
  );
}
