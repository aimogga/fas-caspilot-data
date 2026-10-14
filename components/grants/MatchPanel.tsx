"use client";

// F-504: "How we matched". Renders only the strings stored in match_result.components / flags; it never recomputes a score.
import { useState } from "react";
import { ResponsiveTable } from "@/components/layout";
import { Button } from "@/components/ui/button";
import type { MatchItem } from "@/lib/grants/match-query";
import type { Component } from "@/lib/grants/score";
import type { Flag } from "@/lib/grants/types";

const SEVERITY: Record<Flag["severity"], string> = { blocker: "Blocker", warning: "Warning", info: "Could not check" }; const CELL = "py-2 pr-3 align-top";

export function MatchPanel({ id, components, flags }: { id: string; components: Component[]; flags: Flag[] }) {
  return (
    <div id={id} data-slot="match-panel" className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
      <h3 className="font-medium">How we matched</h3>
      <ul data-slot="match-components" className="flex flex-col gap-2">
        {components.map((c) => <li key={c.key} className="break-words"><span className="font-medium">{c.label}</span> · <span className="tabular-nums">{c.points} of {c.max} points</span> · {c.reason}<span className="block text-xs text-muted-foreground">{c.source_refs.join(", ")}</span></li>)}
      </ul>
      <ul data-slot="match-flags" className="flex flex-col gap-1">
        {flags.length === 0 ? <li className="text-muted-foreground">No eligibility flags</li> : flags.map((f) => <li key={f.code} className="break-words"><span className="font-medium">{SEVERITY[f.severity]}</span> · {f.message}</li>)}
      </ul>
    </div>
  );
}

export function MatchTable({ rows }: { rows: MatchItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ResponsiveTable>
      <caption className="sr-only">Open grant opportunities by fit score</caption>
      <thead><tr><th scope="col">Opportunity</th><th scope="col">Closes</th><th scope="col" className="text-right!">Score</th><th scope="col">Eligibility</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
      <tbody>
        {rows.flatMap((r) => [
          <tr key={r.id} data-match={r.id} className="border-t border-border">
            <th scope="row" className={`${CELL} text-left font-medium`}><span className="block">{r.title}</span><span className="block text-xs font-normal text-muted-foreground">{r.funder}</span></th>
            <td className={CELL}>{r.closes}</td><td className={`${CELL} text-right tabular-nums`}>{r.score}</td><td className={CELL}>{r.eligibility}</td>
            <td className="py-2 align-top"><Button type="button" variant="outline" size="sm" aria-expanded={open === r.id} aria-controls={`match-${r.id}`} onClick={() => setOpen(open === r.id ? null : r.id)}>How we matched</Button></td>
          </tr>,
          open === r.id ? <tr key={`${r.id}-panel`}><td colSpan={5} className="pb-3"><MatchPanel id={`match-${r.id}`} components={r.components} flags={r.flags} /></td></tr> : null,
        ])}
      </tbody>
    </ResponsiveTable>
  );
}
