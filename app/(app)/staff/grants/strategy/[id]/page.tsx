import { randomUUID } from "node:crypto";
import { Check, X } from "lucide-react";
import { reviewStrategy } from "@/app/(app)/staff/grants/strategy/actions";
import { StrategyDraftView } from "@/components/grants/StrategyDraftView";
import { ErrorState, PageHeader, Stack } from "@/components/layout";
import { DraftBanner } from "@/components/trust";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { footerWords, toView, type DraftRow } from "@/lib/strategy/view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const COLS = "id,opportunity_id,status,output,snapshot,citation_report,model_meta,created_by,created_at,approved_by,approved_at,opportunity(title,funder)";
type Row = DraftRow & { opportunity: { title: string; funder: string | null } | null };
const REVIEW: Record<string, string> = { failed: "The review was not saved. Only a draft that passed its citation check can be approved.", denied: "Only an admin can approve or reject a strategy draft." };

export default async function StrategyDraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ review?: string }> }) {
  const [{ id }, { review }] = await Promise.all([params, searchParams]);
  const client = await createClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  const res = client ? await client.from("strategy_draft").select(COLS).eq("id", id).maybeSingle() : null;
  const row = (res?.data ?? null) as Row | null;
  if (res?.error) console.error("[strategy] load failed", { message: res.error.message });
  const title = row?.opportunity ? `Strategy: ${row.opportunity.title}` : "Strategy draft";
  const view = row ? toView(row) : null, foot = row ? footerWords(row, user?.id ?? null) : null;
  const canReview = user?.app_metadata?.role === "admin" && row?.status === "DRAFT" && view?.kind === "usable";
  return (
    <Stack gap={6}>
      <div className="sticky top-24 z-20 md:top-16"><DraftBanner /></div>
      <PageHeader eyebrow="GRANT MATCHES" title={title} description={row?.opportunity?.funder ? `A response strategy for ${row.opportunity.funder}, drafted from stored rows only.` : "Drafted from stored rows only."}
        actions={canReview ? (
          <form className="flex flex-wrap gap-2">
            <Button type="submit" formAction={reviewStrategy.bind(null, id, "approved")}><Check aria-hidden />Approve draft</Button>
            <Button type="submit" variant="outline" formAction={reviewStrategy.bind(null, id, "rejected")}><X aria-hidden />Reject draft</Button>
          </form>) : undefined} />
      {review && REVIEW[review] ? <Alert variant="destructive" data-slot="review-error"><AlertTitle>Review not saved</AlertTitle><AlertDescription>{REVIEW[review]}</AlertDescription></Alert> : null}
      {!row || !view ? <ErrorState message="Couldn't load this strategy draft" referenceId={randomUUID()} href="/staff/grants/matches">It may not exist, or your role can&apos;t see it. Go back to grant matches.</ErrorState>
        : view.kind === "failed" ? <Alert variant="destructive" data-slot="draft-failed"><AlertTitle>This draft failed its citation check and can&apos;t be used</AlertTitle>
            <AlertDescription><p>Some figures did not match the stored rows they cite, so nothing from it is shown. Draft again from the match.</p>
              <ul data-slot="citation-report" className="mt-2 flex list-disc flex-col gap-1 pl-5">{view.lines.map((l, i) => <li key={i}>{l}</li>)}</ul></AlertDescription></Alert>
        : view.kind === "unreadable" ? <ErrorState message="This draft can't be shown" referenceId={id} href="/staff/grants/matches">Its stored content does not match the strategy format. Draft again from the match.</ErrorState>
        : <StrategyDraftView draft={view.draft} facts={view.facts} builtAt={(row.snapshot as { built_at: string }).built_at ?? row.created_at} />}
      {foot ? <footer data-slot="strategy-footer" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
        <span data-slot="model">{foot.model}</span><span>{foot.generated}</span><span data-slot="review">{foot.review}</span></footer> : null}
    </Stack>
  );
}
