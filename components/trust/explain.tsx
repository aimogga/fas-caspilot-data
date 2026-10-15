"use client";
import { Info } from "lucide-react";
import { Fragment, useId, useState, type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { asOfNote } from "@/lib/dashboard/cards";
import { sourceTerm, term, type Term, type TermId } from "@/lib/trust/glossary";
import { cn } from "@/lib/utils";

/** DS-09 explain kit (D-040): one trigger button shows the same words on pointer hover, keyboard focus and tap. */
type Side = "top" | "right" | "bottom" | "left";
type Row = [string, string | number | undefined];
type Rows = { value?: string; source?: string; asOf?: string; hidden?: string; rows?: Row[] };
export type SourceFooterProps = { source: string; period: string; n: string | number; asOf: string };
// 44 px tap target below 1024 (the AggregateFreshnessChip `CHIP` precedent); text triggers get a dotted underline so they read as explainable.
const TRIGGER = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-left lg:min-h-0 lg:min-w-0";
const DOTTED = "underline decoration-dotted underline-offset-4";
const FACE = "max-w-[20rem] text-sm";

/** Pure markup for any face: title, plain words, then only the rows that were given. `asOf` goes through `asOfNote` so a missing date reads "date not available yet". */
export function ExplainBody({ term: t, titleId, value, source, asOf, hidden, rows = [] }: Rows & { term: Term; titleId?: string }) {
  const given: Row[] = [["Value", value], ["Source", source], ["As of", asOf && asOfNote(asOf).replace(/^as of /, "")], ...rows, ["Why it's hidden", hidden]];
  const all = given.flatMap(([k, v]) => (v == null || v === "" ? [] : [[k, String(v)] as const]));
  return (
    <div data-slot="explain-content" className="flex flex-col gap-2">
      <p id={titleId} className="font-medium">{t.title}</p>
      <p className="text-sm">{t.plain}</p>
      {all.length ? <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">{all.map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="tabular-nums">{v}</dd></Fragment>)}</dl> : null}
    </div>
  );
}

export type ExplainCardProps = Rows & { term: TermId | Term; label?: string; side?: Side; icon?: boolean; className?: string; children?: ReactNode };
/** Rich card on a title, number or score. Hover card on pointer and focus; popover dialog on Enter, Space or tap; Escape closes and returns focus. */
export function ExplainCard({ term: id, label, side, icon, className, children, ...rows }: ExplainCardProps) {
  const t = term(id), titleId = useId();
  const [hover, setHover] = useState(false), [open, setOpen] = useState(false);
  const onOpenChange = (next: boolean) => { setOpen(next); setHover(false); };
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <HoverCard open={hover && !open} onOpenChange={setHover} openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" aria-haspopup="dialog" aria-label={icon ? (label ?? `About ${t.title}`) : label} data-slot="explain-trigger" className={cn(TRIGGER, icon ? "w-11 shrink-0 lg:w-auto" : DOTTED, className)}>
              {icon ? <Info aria-hidden className="size-4 text-muted-foreground" /> : children}
            </button>
          </PopoverTrigger>
        </HoverCardTrigger>
        <HoverCardContent side={side} className={FACE}><ExplainBody term={t} {...rows} /></HoverCardContent>
      </HoverCard>
      <PopoverContent side={side} aria-labelledby={titleId} className={FACE}><ExplainBody term={t} titleId={titleId} {...rows} /></PopoverContent>
    </Popover>
  );
}

/** One line of help on a badge, chip, delta or "—": tooltip on hover and focus, popover on click, tap or Enter; the same string both ways. */
export function Hint({ text, label, className, children }: { text: string; label?: string; className?: string; children: ReactNode }) {
  const [tip, setTip] = useState(false), [open, setOpen] = useState(false);
  const onOpenChange = (next: boolean) => { setOpen(next); setTip(false); };
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip open={tip && !open} onOpenChange={setTip}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" aria-haspopup="dialog" aria-label={label} data-slot="hint-trigger" className={cn(TRIGGER, className)}>{children}</button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
      <PopoverContent aria-label={text} className={FACE}><p>{text}</p></PopoverContent>
    </Popover>
  );
}

export type ProvenanceDetail = { sourceId?: string; ingestRunId?: string; lastSuccessAt?: string; vintage?: string };
/** The footer text itself is the trigger: source · period · n · as of, plus the stored-row ids when the page supplies them. */
export function Provenance({ source, period, n, asOf, detail, children }: SourceFooterProps & { detail?: ProvenanceDetail; children?: ReactNode }) {
  const rows: Row[] = [["Period", period], ["n", String(n).replace(/^=\s*/, "")], ["Source id", detail?.sourceId], ["Ingest run", detail?.ingestRunId], ["Last success", detail?.lastSuccessAt], ["Vintage", detail?.vintage]];
  return <ExplainCard term={sourceTerm(source)} source={source} asOf={asOf} rows={rows}>{children}</ExplainCard>;
}
