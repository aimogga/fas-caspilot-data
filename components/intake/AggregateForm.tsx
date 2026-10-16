"use client";

import { useState, type FormEvent } from "react";
import { Stack } from "@/components/layout";
import { AggregateBadge } from "@/components/trust";
import { Hint } from "@/components/trust/explain";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AGGREGATE_METRICS, EMPTY_AGGREGATE, formatValue, metricLabel, NOTE_MAX, periodLabel, validateAggregate, type AggregateError, type AggregateInput, type AggregateRecent } from "@/lib/intake/aggregate";
import { AGGREGATE_BADGE_HINT, AGGREGATE_HELP, aggregateCell, countyWords } from "@/lib/intake/words";

type County = { fips: string; name: string };
type Key = keyof AggregateInput;
const LABEL: Record<Key, string> = { period: "Period (quarter)", metric: "Metric", value: "Total", county_fips: "County", note: "Note (optional)" };
/** DS-23: the badge explains itself (tooltip on hover and focus, popover on tap); one row badge per total stays a plain label because the total beside it opens the same words. */
const Sigma = () => <Hint text={AGGREGATE_BADGE_HINT} label="Aggregate submission" className="rounded-full"><AggregateBadge /></Hint>;
const TOTAL = "inline-flex min-h-11 items-center rounded-sm font-medium tabular-nums underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 lg:min-h-0";

/** F-303: one period total per submit, plus the org's newest totals (read server-side under RLS, prepended locally after a save). */
export function AggregateForm({ counties, recent }: { counties: County[]; recent: AggregateRecent[] }) {
  const [input, setInput] = useState<AggregateInput>(EMPTY_AGGREGATE), [errors, setErrors] = useState<AggregateError[]>([]);
  const [saved, setSaved] = useState<string | null>(null), [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null), [list, setList] = useState(recent);
  const errorFor = (k: Key) => errors.find((e) => e.column === k)?.message, countyName = (fips: string | null) => countyWords(fips, counties);

  function showErrors(errs: AggregateError[]) {
    setErrors(errs);
    document.getElementById(`agg-${(Object.keys(LABEL) as Key[]).find((k) => errs.some((e) => e.column === k))}`)?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(null); setProblem(null);
    const local = validateAggregate(input, { countyFips: new Set(counties.map((c) => c.fips)) });
    if ("errors" in local) return showErrors(local.errors);
    setSaving(true);
    try {
      const res = await fetch("/api/intake/aggregate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const body = (await res.json().catch(() => ({}))) as { id?: string; errors?: AggregateError[]; error?: string };
      if (res.status === 422 && body.errors) return showErrors(body.errors);
      if (!res.ok || !body.id) return setProblem(body.error ?? "Couldn't save the total. Try again.");
      setErrors([]); setSaved(body.id);
      setList([{ id: body.id, ...local.ok }, ...list].slice(0, 10));
    } catch { setProblem("Couldn't reach the server. Check your connection and try again."); } finally { setSaving(false); }
  }

  function field(k: Key, control: (a11y: Record<string, unknown>) => React.ReactNode) {
    const id = `agg-${k}`, err = errorFor(k), hint = AGGREGATE_HELP[k];
    const describedBy = [hint && `${id}-hint`, err && `${id}-error`].filter(Boolean).join(" ") || undefined;
    return (
      <div key={k} data-slot="form-field">
        <Label htmlFor={id}>{LABEL[k]}</Label>
        {control({ id, "aria-invalid": err ? true : undefined, "aria-describedby": describedBy, className: err ? "border-destructive" : undefined, value: input[k], onChange: (e: { target: { value: string } }) => setInput({ ...input, [k]: e.target.value }) })}
        {hint ? <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
        {err ? <p id={`${id}-error`} data-slot="field-error" className="mt-1 text-sm font-medium text-destructive">✕ {err}</p> : null}
      </div>
    );
  }

  const n = new Set(errors.map((e) => e.column)).size;
  return (
    <Stack gap={6}>
      <form noValidate onSubmit={onSubmit} data-slot="aggregate-form">
        <Stack gap={4}>
          <p data-slot="aggregate-notice" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Sigma /> Totals are stored as aggregate submissions and always shown with the Σ Aggregate label.</p>
          {n ? <p role="alert" data-slot="entry-alert" className="text-sm font-medium text-destructive">{n === 1 ? "1 field needs" : `${n} fields need`} attention. Fix the errors shown below each field.</p> : null}
          {field("period", (a) => <input {...a} type="text" inputMode="text" placeholder="2026-Q2" />)}
          {field("metric", (a) => <select {...a}><option value="">Choose…</option>{AGGREGATE_METRICS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}</select>)}
          {field("value", (a) => <input {...a} type="text" inputMode={AGGREGATE_METRICS.find((m) => m.code === input.metric)?.kind === "money" ? "decimal" : "numeric"} />)}
          {field("county_fips", (a) => <select {...a}><option value="">All counties</option>{counties.map((c) => <option key={c.fips} value={c.fips}>{c.name} ({c.fips})</option>)}</select>)}
          {field("note", (a) => <input {...a} type="text" maxLength={NOTE_MAX + 50} />)}
          {problem ? <p role="alert" className="text-sm font-medium text-destructive">{problem}</p> : null}
          {saved ? <p role="status" data-slot="entry-saved" data-id={saved} className="text-base font-medium">Saved aggregate total <code className="tabular-nums">{saved.slice(0, 8)}</code></p> : null}
          {saved ? <Button type="button" onClick={() => { setInput(EMPTY_AGGREGATE); setSaved(null); }}>Add another</Button> : <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save total"}</Button>}
        </Stack>
      </form>
      <section aria-labelledby="agg-recent-title">
        <h2 id="agg-recent-title" className="mb-2 text-base font-semibold">Recent aggregate totals</h2>
        {list.length ? (<ExplainLayer>
          <ul data-slot="aggregate-recent" className="divide-y divide-border text-sm">
            {list.map((r) => <li key={r.id} data-id={r.id} className="flex flex-wrap items-center gap-2 py-2"><AggregateBadge /> {periodLabel(r.period)} · {metricLabel(r.metric_code)} ·{" "}
              <span tabIndex={0} data-slot="aggregate-total" {...aggregateCell(r, counties)} className={TOTAL}>{formatValue(r.metric_code, r.value)}</span> · {countyName(r.county_fips)}</li>)}
          </ul>
        </ExplainLayer>) : <p className="text-sm text-muted-foreground">No aggregate totals yet.</p>}
      </section>
    </Stack>
  );
}
