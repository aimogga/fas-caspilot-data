"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FoundationInput, RowError } from "@/lib/grants/foundation";
import { importReport, parseFoundationCsv, toErrorReportCsv } from "@/lib/grants/foundation-csv";
import { DROP_HELP, IMPORT_INTRO, importFailure, PREVIEW_FIX } from "@/lib/grants/form-words";
import { Done, GrantCard, postFoundation, Problem } from "./FoundationForm";

type Preview = { rows: FoundationInput[]; ok: number; errors: RowError[]; error?: string }; const outline = buttonVariants({ variant: "outline" });
const DROPZONE = "flex w-full flex-col gap-3 rounded-lg border border-dashed border-input bg-card p-6 shadow-sm"; // the DS-18a upload dropzone

/** "Import a list" card: template link, file input, browser-side parse + validate preview, import enabled at zero errors; the server re-validates. */
export function FoundationImport() {
  const router = useRouter(), [preview, setPreview] = useState<Preview | null>(null), [done, setDone] = useState<number | null>(null), [failure, setFailure] = useState<string | null>(null), [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0], parsed = parseFoundationCsv(file ? await file.text() : ''), report = importReport(parsed.rows);
    setDone(null); setFailure(null);
    setPreview(file ? { rows: parsed.rows.map((r) => r.input), ok: report.ok.length, errors: report.errors, error: parsed.error } : null);
  }

  async function run() {
    setBusy(true); setFailure(null);
    const res = await postFoundation({ mode: "csv", rows: preview!.rows }), body = (await res.json().catch(() => ({}))) as { inserted?: number; error?: string; errors?: RowError[] };
    setBusy(false);
    if (!res.ok) setFailure(importFailure(res.status, body)); else { setDone(body.inserted ?? preview!.ok); setPreview(null); router.refresh(); }
  }

  const usable = preview !== null && !preview.error, ready = usable && preview.ok > 0 && preview.errors.length === 0;
  return (
    <GrantCard title="Import a list" slot="foundation-import">
      <p className="text-sm text-muted-foreground">{IMPORT_INTRO}</p>
      <a href="/api/grants/foundation/template" download="fas-foundation-template.csv" className={outline}>Download template</a>
      <div data-slot="dropzone" className={DROPZONE}>
        <div data-slot="form-field"><Label htmlFor="fo-file">CSV file (2 MB max)</Label><Input id="fo-file" type="file" accept=".csv,text/csv" onChange={pick} aria-describedby="fo-file-help" /></div>
        <p id="fo-file-help" className="text-sm text-muted-foreground">{DROP_HELP}</p>
      </div>
      {preview?.error ? <Problem text={preview.error} /> : null}
      {usable ? (
        <Alert variant={preview.errors.length ? "warning" : "info"} data-slot="import-preview">
          {preview.errors.length ? <CircleAlert /> : <CircleCheck />}<AlertTitle>{preview.ok} rows ready · {preview.errors.length} rows with errors</AlertTitle>
          {preview.errors.length ? <AlertDescription><p>{PREVIEW_FIX}</p><a href={`data:text/csv;charset=utf-8,${encodeURIComponent(toErrorReportCsv(preview.errors))}`} download="fas-foundation-errors.csv" className={outline}>Download error report</a></AlertDescription> : null}
        </Alert>
      ) : null}
      {failure ? <Problem text={failure} /> : null}
      {done !== null ? <Done text={`Imported ${done} opportunities`} /> : null}
      <Button type="button" disabled={!ready} loading={busy} onClick={run}>Import {usable ? preview.ok : 0} rows</Button>
    </GrantCard>
  );
}
