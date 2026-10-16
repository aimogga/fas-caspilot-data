"use client";

// DS-12a: the grant matches list. One card per stored match_result; every number, badge and status explains itself (D-040). Renders stored values only.
import { Ban, Check, CircleDot, CircleHelp, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DraftStrategyButton } from "@/components/grants/DraftStrategyButton";
import { MatchPanel } from "@/components/grants/MatchPanel";
import { ExplainCard, Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MatchItem } from "@/lib/grants/match-query";
import { CAP, ELIGIBILITY, FIT_SCORE, FIT_SOURCE, SEVERITY, stageTerm } from "@/lib/grants/terms";
import type { FlagSeverity } from "@/lib/grants/types";

type Variant = "success" | "warning" | "destructive" | "info" | "muted";
const GLYPH: Record<FlagSeverity, ReactNode> = { blocker: <Ban aria-hidden />, warning: <TriangleAlert aria-hidden />, info: <CircleHelp aria-hidden /> };
const SEVERITY_VARIANT: Record<FlagSeverity, Variant> = { blocker: "destructive", warning: "warning", info: "muted" };
const ELIGIBILITY_FACE: Record<keyof typeof ELIGIBILITY, [ReactNode, Variant]> = {
  Eligible: [<Check key="e" aria-hidden />, "success"], "Not eligible": [<Ban key="n" aria-hidden />, "destructive"], "Could not check": [<CircleHelp key="c" aria-hidden />, "muted"], Flagged: [<TriangleAlert key="f" aria-hidden />, "warning"],
};
// The stored eligibility label from MatchQuery ("Flags: 2", "Unknown") as one of the four badge words.
const eligibilityWord = (label: string): keyof typeof ELIGIBILITY => (label === "Eligible" || label === "Not eligible" ? label : label === "Unknown" ? "Could not check" : "Flagged");
const TILE = "flex-col items-start gap-1 rounded-md border border-border bg-background px-3 py-2 no-underline lg:min-w-22";

function FitTile({ row, asOf }: { row: MatchItem; asOf?: string }) {
  const capped = row.components.find((c) => c.key in CAP);
  return (
    <ExplainCard term={FIT_SCORE} value={`${row.score} of 100 points`} source={FIT_SOURCE} asOf={asOf} rows={capped ? [["Why it's 0", capped.reason]] : []} className={TILE}>
      <span data-slot="fit-score" className="text-4xl font-semibold leading-none tabular-nums">{row.score}</span>
      <span className="text-xs tracking-wide text-muted-foreground">fit of 100</span>
    </ExplainCard>
  );
}

function Badges({ row }: { row: MatchItem }) {
  const word = eligibilityWord(row.eligibility), [glyph, variant] = ELIGIBILITY_FACE[word], stage = stageTerm(row.status);
  return (
    <ul data-slot="match-badges" className="flex flex-wrap gap-2">
      <li><Hint text={ELIGIBILITY[word].plain}><Badge data-slot="eligibility" variant={variant} prefix={glyph}>{word}</Badge></Hint></li>
      {row.flags.map((f) => <li key={f.code}><Hint text={SEVERITY[f.severity].plain}><Badge data-slot="flag" data-severity={f.severity} variant={SEVERITY_VARIANT[f.severity]} prefix={GLYPH[f.severity]} className="whitespace-normal text-left">{f.message}</Badge></Hint></li>)}
      <li><Hint text={stage.plain}><Badge data-slot="stage" variant={row.status === null ? "muted" : "info"} prefix={<CircleDot aria-hidden />}>{stage.title}</Badge></Hint></li>
    </ul>
  );
}

/** `ol > li[data-match]`, best fit first (the query sorts). One "How we matched" panel open at a time. */
export function MatchList({ rows, asOf }: { rows: MatchItem[]; asOf?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ol data-slot="match-list" className="flex flex-col gap-4">
      {rows.map((r) => (
        <li key={r.id} data-match={r.id} className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm lg:grid-cols-[auto_1fr] lg:gap-6 lg:p-6">
          <div><FitTile row={r} asOf={asOf} /></div>
          <div className="flex min-w-0 flex-col gap-3">
            <h3 className="text-base font-medium leading-snug break-words">{r.title}</h3>
            <p data-slot="match-meta" className="text-sm text-muted-foreground">{r.funder} · {r.closes} · <span className="tabular-nums">{r.award}</span></p>
            <Badges row={r} />
            <div className="flex flex-wrap items-start gap-2"><Button type="button" variant="outline" size="sm" aria-expanded={open === r.id} aria-controls={`match-${r.id}`} onClick={() => setOpen(open === r.id ? null : r.id)}>How we matched</Button>
              <DraftStrategyButton opportunityId={r.opportunityId} /></div>
            {open === r.id ? <MatchPanel id={`match-${r.id}`} components={r.components} flags={r.flags} /> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
