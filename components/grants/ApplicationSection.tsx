// F-508h: one application section under the funder's heading. Stored text only; citation chips open the explain card (D-040); edits post to a server action.
import { FileText, TriangleAlert } from "lucide-react";
import { saveSection } from "@/app/(app)/staff/grants/applications/[id]/actions";
import { ExplainCard, Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Section } from "@/lib/application/generate";
import { factWords, UNCITED, type SectionReview } from "@/lib/application/review";
import type { Fact } from "@/lib/strategy/snapshot";

const FIELD = "min-h-48 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-solid focus-visible:[outline-color:var(--ring)] focus-visible:outline-offset-2";

function Chip({ id, fact }: { id: string; fact?: Fact }) {
  if (!fact) return <Hint text="This citation is not in the stored snapshot, so it cannot be shown."><Badge variant="destructive" prefix={<TriangleAlert aria-hidden />}>Missing source</Badge></Hint>;
  const w = factWords(fact);
  return (
    <ExplainCard term={{ id, title: fact.label, plain: `${w.kind}: a stored row this section cites.` }} value={w.value || undefined} source={w.source} asOf={w.asOf} rows={[["Id", id]]} className="no-underline">
      <Badge data-slot="citation" variant="info" prefix={<FileText aria-hidden />} className="max-w-72 truncate">{fact.label}</Badge>
    </ExplainCard>
  );
}

export function ApplicationSection({ draftId, section: s, review, facts, editable }: { draftId: string; section: Section; review: SectionReview; facts: Map<string, Fact>; editable: boolean }) {
  return (
    <li id={s.key} data-section={s.key} data-blocked={review.blocked || undefined} className="flex scroll-mt-28 flex-col gap-3 border-t border-border pt-6">
      <h3 className="font-serif text-lg font-semibold">{s.heading}{s.points !== null ? <span className="ml-2 text-sm font-normal text-muted-foreground">{s.points} points</span> : null}</h3>
      <p className="text-sm text-muted-foreground">Criterion: {s.criterion}</p>
      <p data-slot="word-count" data-over={review.over.length > 0 || undefined} className="text-sm tabular-nums">{review.words}</p>
      {s.status === "needs_edit" && s.reasons.length ? (
        <div data-slot="needs-edit" role="note" className="rounded-md border border-warning bg-warning-soft p-3 text-sm"><p className="font-medium">Needs an edit before approval</p><ul className="list-disc pl-5">{s.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
      ) : null}
      {review.over.map((o) => <p key={o} data-slot="over-limit" className="text-sm text-destructive">{o}</p>)}
      {review.uncited.length ? <p data-slot="uncited" role="status" className="text-sm text-destructive">{UNCITED} ({review.uncited.join(", ")})</p> : null}
      <div data-slot="section-body" className="whitespace-pre-line text-base leading-relaxed">{s.body || <span className="text-muted-foreground">No text yet.</span>}</div>
      {s.citation_ids.length ? <ul data-slot="citations" aria-label="Sources cited" className="flex flex-wrap gap-2">{s.citation_ids.map((c) => <li key={c}><Chip id={c} fact={facts.get(c)} /></li>)}</ul> : null}
      {s.assumptions.length ? <div data-slot="assumptions" className="text-sm"><p className="font-medium">Assumptions</p><ul className="list-disc pl-5 text-muted-foreground">{s.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></div> : null}
      {editable ? (
        <details data-slot="edit" className="group">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium underline underline-offset-4">Edit this section</summary>
          <form action={saveSection} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="id" value={draftId} /><input type="hidden" name="key" value={s.key} />
            <label htmlFor={`body-${s.key}`} className="text-sm font-medium">Text for {s.heading}</label><textarea id={`body-${s.key}`} name="body" defaultValue={s.body} className={FIELD} />
            <p className="text-xs text-muted-foreground">Saving keeps the earlier text in the edit history. A number with no cited source shows a warning.</p>
            <Button type="submit" className="self-start">Save section</Button>
          </form>
        </details>
      ) : null}
    </li>
  );
}
