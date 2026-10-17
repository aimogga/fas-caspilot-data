import { randomUUID } from "node:crypto";
import Link from "next/link";
import { EmptyState, ErrorState, PageHeader, Stack } from "@/components/layout";
import { DraftNotice, FormulaBlock, InputsTable, LimitsSection, ReliabilitySection, MethodologyToc, Sec, TOC, VersionLine, WeightCards } from "@/components/methodology";
import { FreshnessChip, NotPublished } from "@/components/trust";
import { Hint } from "@/components/trust/explain";
import { buttonVariants } from "@/components/ui/button";
import { MethodologyQuery, type MethodologyView } from "@/lib/methodology/query";
import { headlines, summary } from "@/lib/methodology/words";
import { whyHidden } from "@/lib/trust/glossary";
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
  const h = view ? headlines(view) : null, eyebrow = Object.fromEntries(TOC);
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
          <VersionLine lines={summary(view)} synthetic={view.synthetic} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
            <MethodologyToc items={TOC} />
            <Stack gap={12}>
              <Sec id="how" eyebrow={eyebrow.how!} title={h!.how}><FormulaBlock view={view} /></Sec>
              <Sec id="inputs" eyebrow={eyebrow.inputs!} title={h!.inputs}><InputsTable caption={`Public inputs for need score version ${view.version}`} rows={view.inputs} /></Sec>
              <Sec id="weights" eyebrow={eyebrow.weights!} title={h!.weights}>
                <WeightCards view={view} />
                {view.mismatch ? <p data-slot="weights-mismatch" className="text-sm text-warning">{view.mismatch}</p> : null}
              </Sec>
              <Sec id="reliability" eyebrow={eyebrow.reliability!} title={h!.reliability}><ReliabilitySection view={view} /></Sec>
              <Sec id="vintages" eyebrow={eyebrow.vintages!} title={h!.vintages}>
                <p className="max-w-prose text-sm">Each input carries the vintage the source published and the date of our last successful load.</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {view.inputs.map((r) => <li key={r.key} data-vintage={r.key} className="flex flex-wrap items-center gap-2"><span>{r.label}: {r.source} {r.vintage} · as of {r.asOf}</span>{r.status === "current" ? <FreshnessChip status="current" /> : <NotPublished />}</li>)}
                </ul>
                {view.notPublished ? <p data-slot="not-published-count" className="text-sm text-muted-foreground"><Hint text={whyHidden("not_published")} className="underline decoration-dotted underline-offset-4">{view.notPublished}</Hint></p> : null}
              </Sec>
              <Sec id="limits" eyebrow={eyebrow.limits!} title={h!.limits}><LimitsSection /></Sec>
            </Stack>
          </div>
          <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{view.footer}</p>
        </>
      )}
    </Stack>
  );
}
