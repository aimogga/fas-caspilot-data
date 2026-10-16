"use client";

// DS-12a/b: the grant matches list. One card per stored match_result; every number, badge and status explains itself (D-040). Renders stored values only.
import { Ban, Check, CircleDot, CircleHelp, TriangleAlert } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { EMPTY_PANEL, MatchPanel } from "@/components/grants/MatchPanel";
import { ExplainCard, Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MatchItem } from "@/lib/grants/match-query";
import { CAP, ELIGIBILITY, FIT_SCORE, FIT_SOURCE, flagWords, SEVERITY, sourceWords, stageTerm } from "@/lib/grants/terms";
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
const PAGE = 10;
const LG = "(min-width: 1024px)";
const subscribe = (cb: () => void) => { const m = window.matchMedia(LG); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
/** True at ≥ 1024, where the panel is a sticky aside beside the list; false on the server and below, where it sits inside the open card. */
const useLg = () => useSyncExternalStore(subscribe, () => window.matchMedia(LG).matches, () => false);

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
      {row.flags.map((f) => (
        <li key={f.code}>
          <ExplainCard term={SEVERITY[f.severity]} rows={[["Stored reason", f.message], ["Checked from", sourceWords(f.source_ref).label]]} className="no-underline">
            <Badge data-slot="flag" data-severity={f.severity} variant={SEVERITY_VARIANT[f.severity]} prefix={GLYPH[f.severity]} className="whitespace-normal text-left">{flagWords(f.code, f.message)}</Badge>
          </ExplainCard>
        </li>
      ))}
      <li><Hint text={stage.plain}><Badge data-slot="stage" variant={row.status === null ? "muted" : "info"} prefix={<CircleDot aria-hidden />}>{stage.title}</Badge></Hint></li>
    </ul>
  );
}

/** `ol > li[data-match]`, best fit first (the query sorts), ten at a time. One "How we matched" panel open at a time: a sticky aside at ≥ 1024, inside the card below. */
export function MatchList({ rows, asOf }: { rows: MatchItem[]; asOf?: string }) {
  const [open, setOpen] = useState<string | null>(null), [shown, setShown] = useState(PAGE), lg = useLg();
  const visible = rows.slice(0, shown), current = rows.find((r) => r.id === open) ?? null, left = rows.length - shown;
  const close = (id: string) => { setOpen(null); document.querySelector<HTMLElement>(`[aria-controls="match-${id}"]`)?.focus(); };
  const panel = (r: MatchItem) => <MatchPanel id={`match-${r.id}`} row={r} asOf={asOf} onClose={() => close(r.id)} />;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <ol data-slot="match-list" className="flex flex-col gap-4">
          {visible.map((r) => (
            <li key={r.id} data-match={r.id} className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm lg:grid-cols-[auto_1fr] lg:gap-6 lg:p-6">
              <div><FitTile row={r} asOf={asOf} /></div>
              <div className="flex min-w-0 flex-col gap-3">
                <h3 className="text-base font-medium leading-snug break-words">{r.title}</h3>
                <p data-slot="match-meta" className="text-sm text-muted-foreground">{r.funder} · {r.closes} · <span className="tabular-nums">{r.award}</span></p>
                <Badges row={r} />
                <div><Button type="button" variant="outline" size="sm" aria-expanded={open === r.id} aria-controls={`match-${r.id}`} onClick={() => (open === r.id ? close(r.id) : setOpen(r.id))}>How we matched</Button></div>
                {!lg && open === r.id ? panel(r) : null}
              </div>
            </li>
          ))}
        </ol>
        {rows.length > PAGE ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p data-slot="match-count" aria-live="polite" className="text-sm text-muted-foreground tabular-nums">Showing {visible.length} of {rows.length}</p>
            {left > 0 ? <Button type="button" variant="outline" onClick={() => setShown((s) => s + PAGE)}>{left > PAGE ? `Show ${PAGE} more` : `Show the last ${left}`}</Button> : null}
          </div>
        ) : null}
      </div>
      {lg ? <div data-slot="match-aside" className="lg:sticky lg:top-20">{current ? panel(current) : <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{EMPTY_PANEL}</p>}</div> : null}
    </div>
  );
}
