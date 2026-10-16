import { Archive, ChevronRight, CircleCheck, PencilLine } from "lucide-react";
import { KnowledgeForm, StatusActions } from "@/components/knowledge/KnowledgeForm";
import { Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import type { Status } from "@/lib/knowledge/store";
import { editorWords, groupByCategory, type ListRow, monthYear, STATUS_WORDS } from "@/lib/knowledge/view";

const ICON = { draft: <PencilLine aria-hidden />, approved: <CircleCheck aria-hidden />, archived: <Archive aria-hidden /> };
const VARIANT = { draft: "warning", approved: "success", archived: "muted" } as const;
const SUMMARY = "flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 font-medium underline-offset-4 hover:underline";
const Arrow = () => <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />;

/** Status in a glyph and a word, with a one-line hint on hover, focus and tap. */
export function StatusBadge({ status }: { status: Status }) {
  const w = STATUS_WORDS[status];
  return <Hint text={w.hint} label={`Status: ${w.label}. ${w.hint}`}><Badge variant={VARIANT[status]} prefix={ICON[status]}>{w.label}</Badge></Hint>;
}

function History({ row, me }: { row: ListRow; me: string | null }) {
  return (
    <details data-slot="knowledge-history" className="group">
      <summary className={SUMMARY}><Arrow />Version history ({row.history.length})</summary>
      <ol className="mt-2 flex flex-col gap-3 border-l border-border pl-4">
        {row.history.map((v) => (
          <li key={v.version} className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Version {v.version} · {STATUS_WORDS[v.status].label} · {monthYear(v.recorded_at)} · by {editorWords(v.edited_by, me)}</p>
            <p className="font-medium">{v.title}</p>
            <p className="max-w-[72ch] whitespace-pre-line text-sm">{v.body}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function Entry({ row, me, editable }: { row: ListRow; me: string | null; editable: boolean }) {
  const last = row.history[0];
  const facts = [row.source ? `Source: ${row.source}` : "No source given", row.as_of ? `as of ${monthYear(row.as_of)}` : null,
    `Version ${row.version}`, last ? `last edited ${monthYear(last.recorded_at)} by ${editorWords(last.edited_by, me)}` : null].filter(Boolean);
  return (
    <li data-slot="knowledge-row" data-status={row.status} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{row.title}</h3>
        <StatusBadge status={row.status} />
      </div>
      <p className="max-w-[72ch] whitespace-pre-line">{row.body}</p>
      <p data-slot="knowledge-facts" className="text-sm text-muted-foreground">{facts.join(" · ")}</p>
      {editable ? <StatusActions row={row} /> : null}
      {editable ? <details data-slot="knowledge-edit" className="group"><summary className={SUMMARY}><Arrow />Edit</summary><div className="mt-3"><KnowledgeForm row={row} /></div></details> : null}
      {row.history.length ? <History row={row} me={me} /> : null}
    </li>
  );
}

/** Rows grouped by category in a fixed order. `editable` is the admin view; staff get the same list read-only. */
export function KnowledgeList({ rows, me, editable }: { rows: ListRow[]; me: string | null; editable: boolean }) {
  return groupByCategory(rows).map((g) => (
    <section key={g.category} data-slot="knowledge-group" aria-labelledby={`kg-${g.category}`} className="flex flex-col gap-4">
      <h2 id={`kg-${g.category}`} className="font-serif text-xl font-semibold">{g.label} <span className="text-base font-normal text-muted-foreground">({g.rows.length})</span></h2>
      <ul className="flex flex-col gap-4">{g.rows.map((r) => <Entry key={r.id} row={r} me={me} editable={editable} />)}</ul>
    </section>
  ));
}
