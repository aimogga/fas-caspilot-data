"use client";

import { useState, type FormEvent } from "react";
import { Stack } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { controlFor, emptyRow, hintFor } from "@/lib/intake/entry";
import { INTAKE_ENTITIES, INTAKE_SCHEMA, type Field, type IntakeEntity } from "@/lib/intake/schema";
import { validateRows, type RowError } from "@/lib/intake/validate";

type County = { fips: string; name: string };
const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1);

export function EntryForm({ counties }: { counties: County[] }) {
  const [entity, setEntity] = useState<IntakeEntity>("case");
  const [row, setRow] = useState<Record<string, string>>(() => emptyRow("case"));
  const [errors, setErrors] = useState<RowError[]>([]);
  const [saved, setSaved] = useState<{ entity: IntakeEntity; id: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fields = INTAKE_SCHEMA[entity].fields.filter((f) => controlFor(f) !== "hidden");
  const errorFor = (key: string) => errors.find((e) => e.column === key)?.message;

  const reset = (next: IntakeEntity) => { setEntity(next); setRow(emptyRow(next)); setErrors([]); setSaved(null); setProblem(null); };

  function showErrors(errs: RowError[]) {
    setErrors(errs);
    const first = fields.find((f) => errs.some((e) => e.column === f.key));
    if (first) document.getElementById(`entry-${first.key}`)?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(null); setProblem(null);
    const local = validateRows(entity, [row], { countyFips: new Set(counties.map((c) => c.fips)) });
    if (local.errors.length) return showErrors(local.errors);
    setSaving(true);
    try {
      const res = await fetch("/api/intake/entry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entity, row }) });
      const body = (await res.json().catch(() => ({}))) as { id?: string; errors?: RowError[]; error?: string };
      if (res.status === 422 && body.errors) return showErrors(body.errors);
      if (!res.ok || !body.id) return setProblem(body.error ?? "Couldn't save the record. Try again.");
      setErrors([]); setSaved({ entity, id: body.id });
    } catch {
      setProblem("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function control(f: Field) {
    const id = `entry-${f.key}`, err = errorFor(f.key), hint = hintFor(f);
    const describedBy = [hint && `${id}-hint`, err && `${id}-error`].filter(Boolean).join(" ") || undefined;
    const a11y = { id, "aria-invalid": err ? true : undefined, "aria-describedby": describedBy, className: err ? "border-destructive" : undefined };
    const set = (v: string) => setRow({ ...row, [f.key]: v }), kind = controlFor(f), value = row[f.key] ?? "";
    if (kind === "yesno" || kind === "select" || kind === "county") {
      return (
        <select {...a11y} value={value} onChange={(e) => set(e.target.value)}>
          <option value="">Choose…</option>
          {kind === "yesno" ? [["yes", "Yes"], ["no", "No"]].map(([v, l]) => <option key={v} value={v}>{l}</option>) : null}
          {kind === "select" ? f.values?.map((v) => <option key={v} value={v}>{v}</option>) : null}
          {kind === "county" ? counties.map((c) => <option key={c.fips} value={c.fips}>{c.name} ({c.fips})</option>) : null}
        </select>
      );
    }
    const inputMode = f.type === "integer" ? "numeric" : f.type === "money" ? "decimal" : undefined;
    return <input {...a11y} type={kind === "date" ? "date" : "text"} inputMode={inputMode} value={value} onChange={(e) => set(e.target.value)} />;
  }

  const n = new Set(errors.map((e) => e.column)).size;
  return (
    <form noValidate onSubmit={onSubmit} data-slot="entry-form">
      <Stack gap={4}>
        <div data-slot="form-field">
          <label htmlFor="entry-entity" className="mb-2 block text-sm font-medium">What are you adding?</label>
          <select id="entry-entity" value={entity} onChange={(e) => reset(e.target.value as IntakeEntity)}>
            {INTAKE_ENTITIES.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}
          </select>
        </div>
        {n ? <p role="alert" data-slot="entry-alert" className="text-sm font-medium text-destructive">{n === 1 ? "1 field needs" : `${n} fields need`} attention. Fix the errors shown below each field.</p> : null}
        {fields.map((f) => {
          const err = errorFor(f.key), hint = hintFor(f);
          return (
            <div key={f.key} data-slot="form-field">
              <label htmlFor={`entry-${f.key}`} className="mb-2 flex items-center gap-2 text-sm font-medium">
                {f.label} {f.required ? <Badge variant="info" prefix={<span aria-hidden>*</span>}>Required</Badge> : null}
              </label>
              {control(f)}
              {hint ? <p id={`entry-${f.key}-hint`} className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
              {err ? <p id={`entry-${f.key}-error`} data-slot="field-error" className="mt-1 text-sm font-medium text-destructive">✕ {err}</p> : null}
            </div>
          );
        })}
        {problem ? <p role="alert" className="text-sm font-medium text-destructive">{problem}</p> : null}
        {saved ? (
          <p role="status" data-slot="entry-saved" data-id={saved.id} className="text-base font-medium">Saved {titleCase(saved.entity)} <code className="tabular-nums">{saved.id.slice(0, 8)}</code></p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {saved ? <Button type="button" onClick={() => reset(entity)}>Add another</Button> : <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>}
          {saved ? <Button type="button" variant="outline" onClick={() => navigator.clipboard?.writeText(saved.id)}>Copy id</Button> : null}
        </div>
      </Stack>
    </form>
  );
}
