"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent } from "react";
import { FormField, ResponsiveTable, Stack } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { postJson, savedText } from "@/lib/intake/commit";
import { parseCsv, toErrorReportCsv } from "@/lib/intake/csv";
import { applyMapping, autoMap, fileProblem, missingRequired, PREVIEW_ROWS, summarize, type Mapping } from "@/lib/intake/mapping";
import { INTAKE_ENTITIES, INTAKE_SCHEMA, type IntakeEntity } from "@/lib/intake/schema";
import { validateRows } from "@/lib/intake/validate";
import { useHydrated } from "@/lib/use-hydrated";

type Step = 1 | 2 | 3; type Parsed = { name: string; headers: string[]; rows: string[][] };
type Saved = { batchId: string; rows: number };
const STEPS = ["Choose file", "Map columns", "Preview"] as const;
const NOT_IN_FILE = "";
const NUMERIC = new Set(["integer", "money"]);
const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1);

function download(name: string, csv: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function UploadWizard({ countyFips }: { countyFips: string[] }) {
  const [step, setStep] = useState<Step>(1);
  const [entity, setEntity] = useState<IntakeEntity>("case");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const fields = INTAKE_SCHEMA[entity].fields;
  const missing = missingRequired(mapping, entity);
  const hydrated = useHydrated();

  const preview = useMemo(() => {
    if (step !== 3 || !parsed) return null;
    const records = applyMapping(parsed.headers, parsed.rows, mapping);
    const result = validateRows(entity, records, { countyFips: new Set(countyFips) });
    return { records, result, summary: summarize(result) };
  }, [step, parsed, mapping, entity, countyFips]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const table = parseCsv(await file.text());
    const problem = fileProblem(file.size, table);
    setFileError(problem);
    if (problem) return setParsed(null);
    const [headers, ...rows] = table;
    const hs = headers.map((h) => h.trim());
    setParsed({ name: file.name, headers: hs, rows });
    setMapping(autoMap(hs, entity));
  }

  /** Both writes go through the API routes; the server re-validates and the database stamps org and batch ids. */
  async function post(path: string, body: unknown) {
    setBusy(true); setSaveError(null);
    const { data, error } = await postJson(path, body);
    setBusy(false); setSaveError(error); router.refresh(); return data;
  }
  async function save() {
    const data = parsed && (await post("/api/intake/commit", { entity, mapping, headers: parsed.headers, rows: parsed.rows }));
    if (data) setSaved({ batchId: String(data.batchId), rows: Number(data.rows) });
  }
  const reset = () => { setStep(1); setParsed(null); setFileError(null); setMapping({}); setSaved(null); setSaveError(null); };
  /** After a rollback the wizard restarts; the batch shows as Rolled back in the list below. */
  const rollBack = async () => saved && window.confirm("Roll back this upload? Its rows will be removed.") && (await post("/api/intake/rollback", { batchId: saved.batchId })) && reset();

  if (saved) return (
    <Stack gap={4}>
      <h2 className="font-serif text-xl font-semibold">Upload saved</h2>
      <p role="status" className="text-base tabular-nums">{savedText(saved.rows, saved.batchId)}</p>
      {saveError ? <p role="alert" className="text-sm text-destructive">{saveError}</p> : null}
      <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={busy} onClick={rollBack}>Roll back this upload</Button><Button type="button" onClick={reset}>Start another upload</Button></div>
    </Stack>
  );

  return (
    <Stack gap={6}>
      <ol data-slot="wizard-steps" data-hydrated={hydrated || undefined} className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? "step" : undefined} className={step === i + 1 ? "font-semibold" : "text-muted-foreground"}>
            {i + 1} {label}{step === i + 1 ? <span className="sr-only"> (current step)</span> : null}
          </li>
        ))}
      </ol>
      <h2 className="font-serif text-xl font-semibold">Step {step} of 3: {STEPS[step - 1]}</h2>
      {step === 1 ? (
        <Stack gap={4}>
          <FormField label="What are you uploading?" htmlFor="intake-entity">
            <select id="intake-entity" value={entity} onChange={(e) => { setEntity(e.target.value as IntakeEntity); setParsed(null); }}>
              {INTAKE_ENTITIES.map((e) => <option key={e} value={e}>{titleCase(e)} records</option>)}
            </select>
          </FormField>
          <a className={buttonVariants({ variant: "outline" })} href={`/api/intake/template?entity=${entity}`}>Download template</a>
          <FormField label="CSV file (5 MB max)" htmlFor="intake-file">
            <input id="intake-file" type="file" accept=".csv,text/csv" onChange={onFile} aria-describedby={fileError ? "intake-file-error" : undefined} aria-invalid={fileError ? true : undefined} />
          </FormField>
          {fileError ? <p id="intake-file-error" role="alert" className="text-sm text-destructive">{fileError}</p> : null}
          {parsed ? <p className="text-sm">{parsed.name} · <span className="tabular-nums">{parsed.rows.length}</span> data rows found.</p> : null}
          <div className="flex flex-wrap gap-3">
            <a className={buttonVariants({ variant: "outline" })} href="/staff">Back</a>
            <Button type="button" disabled={!parsed} onClick={() => setStep(2)}>Next</Button>
          </div>
        </Stack>
      ) : null}
      {step === 2 && parsed ? (
        <Stack gap={4}>
          <p className="text-sm text-muted-foreground">Match each field to a column in {parsed.name}. Columns named like the template are already matched.</p>
          {fields.map((f) => (
            <div key={f.key} data-slot="form-field">
              <label htmlFor={`map-${f.key}`} className="mb-2 flex items-center gap-2 text-sm font-medium">
                {f.label} {f.required ? <Badge variant="info" prefix={<span aria-hidden>*</span>}>Required</Badge> : null}
              </label>
              <select id={`map-${f.key}`} value={mapping[f.key] ?? NOT_IN_FILE} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || null })}>
                <option value={NOT_IN_FILE}>Not in file</option>
                {parsed.headers.map((h, i) => <option key={`${h}-${i}`} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
          {missing.length ? <p id="map-missing" role="alert" className="text-sm text-destructive">Choose a column for each required field before continuing: {missing.join(", ")}.</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" disabled={missing.length > 0} aria-describedby={missing.length ? "map-missing" : undefined} onClick={() => setStep(3)}>Next</Button>
          </div>
        </Stack>
      ) : null}
      {step === 3 && parsed && preview ? (
        <Stack gap={4}>
          <p data-slot="preview-summary" className="text-base font-medium tabular-nums">{preview.summary.text}</p>
          <p className="text-sm text-muted-foreground">Showing the first {Math.min(PREVIEW_ROWS, parsed.rows.length)} of {parsed.rows.length} rows. Cells marked Error carry the reason in a tooltip; the error report lists every one.</p>
          <ResponsiveTable>
            <thead>
              <tr>
                <th scope="col" className="text-right">Row</th>
                {fields.map((f) => <th key={f.key} scope="col" className={NUMERIC.has(f.type) ? "text-right" : undefined}>{f.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {preview.records.slice(0, PREVIEW_ROWS).map((rec, i) => (
                <tr key={i}>
                  <th scope="row" className="text-right tabular-nums">{i + 2}</th>
                  {fields.map((f) => {
                    const msg = preview.summary.byCell.get(`${i + 2}:${f.key}`);
                    return (
                      <td key={f.key} data-error={msg ? "true" : undefined} title={msg ? `✕ ${msg}` : undefined} className={NUMERIC.has(f.type) ? "text-right tabular-nums" : undefined}>
                        {msg ? <><span className="font-semibold text-destructive">Error</span><span className="sr-only">: {msg}</span> </> : null}{rec[f.key]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
            {preview.result.errors.length ? (
              <Button type="button" variant="outline" onClick={() => download(`fas-${entity}-errors.csv`, toErrorReportCsv(preview.result.errors))}>Download error report</Button>
            ) : null}
            <Button type="button" disabled={preview.result.errors.length > 0 || busy} loading={busy} aria-describedby="save-help" onClick={save}>Save</Button>
          </div>
          {saveError ? <p role="alert" className="text-sm text-destructive">{saveError}</p> : null}
          <p id="save-help" className="text-sm text-muted-foreground">{preview.result.errors.length ? "Fix every error before saving. Nothing from this file has been stored yet." : `Save stores all ${preview.result.ok.length} rows as one batch you can roll back later.`}</p>
        </Stack>
      ) : null}
    </Stack>
  );
}
