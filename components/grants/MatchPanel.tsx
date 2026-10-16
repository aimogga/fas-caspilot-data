"use client";

// DS-12b: "How we matched". Every string comes from match_result.components / flags, opportunity and award_history; nothing is recomputed (F-504, D-040).
import { Ban, Check, CircleHelp, TriangleAlert } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { ExplainCard, Hint } from "@/components/trust/explain";
import { Button } from "@/components/ui/button";
import type { MatchItem } from "@/lib/grants/match-query";
import type { Component } from "@/lib/grants/score";
import { CAP, type CheckRow, checklist, COMPONENT, FIT_SOURCE, SEVERITY, sourceWords, usd } from "@/lib/grants/terms";
import type { CheckStatus } from "@/lib/grants/types";

const CHIP = "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground";
const ICON = "size-4 shrink-0";
const GLYPH: Record<CheckStatus | "blocker", ReactNode> = {
  pass: <Check aria-hidden className={`${ICON} text-success`} />, flagged: <TriangleAlert aria-hidden className={`${ICON} text-warning`} />,
  unclear: <CircleHelp aria-hidden className={`${ICON} text-muted-foreground`} />, blocker: <Ban aria-hidden className={`${ICON} text-destructive`} />,
};
const AWARDS = "Counted from public award records for the same Assistance Listing. The middle award means half were smaller, half larger.";
export const EMPTY_PANEL = "Open How we matched on any row to see its six parts and the eligibility checks here.";

/** The stored source refs as chips in words (`FAS settings · program themes`), each with a hint; the path itself never shows. */
function Sources({ refs }: { refs: string[] }) {
  return (
    <ul data-slot="match-sources" className="flex flex-wrap gap-x-1 gap-y-0">
      {refs.map((ref) => { const w = sourceWords(ref); return <li key={ref}><Hint text={w.plain}><span className={CHIP}>{w.label}</span></Hint></li>; })}
    </ul>
  );
}

/** One score part: label (explain card), points of max as text, a bar that only illustrates, the stored reason, the sources. */
function Part({ c, asOf }: { c: Component; asOf?: string }) {
  const term = COMPONENT[c.key] ?? { id: c.key, title: c.label, plain: "One part of the fit score, as the matching rules stored it." };
  const width = c.max > 0 ? `${Math.round((c.points / c.max) * 100)}%` : "0%";
  return (
    <li data-slot="match-component" data-key={c.key} className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <ExplainCard term={term} value={`${c.points} of ${c.max} points`} source={FIT_SOURCE} asOf={asOf} className="text-sm font-medium">{term.title}</ExplainCard>
        <span className="shrink-0 text-sm tabular-nums"><span className="font-semibold">{c.points}</span> of {c.max} points</span>
      </div>
      <span aria-hidden className="relative h-2 overflow-hidden rounded-r-[4px] bg-muted"><span className="absolute inset-y-0 left-0 bg-chart-1" style={{ width }} /></span>
      <p className="text-sm text-muted-foreground">{c.reason}</p>
      <Sources refs={c.source_refs} />
    </li>
  );
}

/** One of the ten checks: glyph + name + words. A flagged or unclear row opens a card with the stored reason and where it was checked from. */
function CheckItem({ row }: { row: CheckRow }) {
  const body = <span><span className="font-medium">{row.label}</span> · {row.words}</span>;
  return (
    <li data-slot="match-check" data-status={row.status} className="flex items-start gap-2 text-sm">
      <span className="mt-0.5">{GLYPH[row.flag?.severity === "blocker" ? "blocker" : row.status]}</span>
      {row.flag ? <ExplainCard term={SEVERITY[row.flag.severity]} rows={[["Stored reason", row.flag.message], ["Checked from", sourceWords(row.flag.source_ref).label]]} className="justify-start">{body}</ExplainCard> : body}
    </li>
  );
}

export function MatchPanel({ id, row, asOf, onClose }: { id: string; row: MatchItem; asOf?: string; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [row.id]);
  const parts = row.components.filter((c) => !(c.key in CAP)), caps = row.components.filter((c) => c.key in CAP);
  return (
    <aside id={id} data-slot="match-panel" aria-labelledby={`${id}-title`} className="flex flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-sm lg:p-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">How we matched</p>
        <h3 id={`${id}-title`} ref={heading} tabIndex={-1} className="font-serif text-xl leading-snug font-semibold break-words">{row.title}</h3>
        <p className="flex items-baseline gap-2"><span data-slot="panel-score" className="text-4xl leading-none font-semibold tabular-nums">{row.score}</span><span className="text-sm text-muted-foreground">of 100 fit</span></p>
      </div>
      <ul data-slot="match-components" className="flex flex-col gap-4">{parts.map((c) => <Part key={c.key} c={c} asOf={asOf} />)}</ul>
      {caps.map((c) => <p key={c.key} data-slot="match-cap" className="text-sm"><ExplainCard term={CAP[c.key]} source={FIT_SOURCE} asOf={asOf} className="font-medium">{CAP[c.key].title}</ExplainCard>: {c.reason}</p>)}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Eligibility checks</h4>
        <ul data-slot="match-checks" className="flex flex-col gap-2">{checklist(row.flags).map((r) => <CheckItem key={r.code} row={r} />)}</ul>
      </div>
      {row.awards && row.awards.count > 0 ? (
        <p data-slot="match-awards" className="text-sm text-muted-foreground">
          <Hint text={AWARDS} className="underline decoration-dotted underline-offset-4">Past winners on this listing: {row.awards.count} awards{row.awards.median !== null ? `, the middle one ${usd(row.awards.median)}` : ""}.</Hint> Full winning applications are not public.
        </p>
      ) : null}
      <div><Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button></div>
    </aside>
  );
}
