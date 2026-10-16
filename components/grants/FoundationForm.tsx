"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FOUNDATION_FIELDS, type FoundationInput, type RowError, validateFoundation } from "@/lib/grants/foundation";
import { formHelp, saveFailure } from "@/lib/grants/form-words";

export const postFoundation = (body: unknown) => fetch("/api/grants/foundation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const Problem = ({ text }: { text: string }) => <Alert variant="destructive"><CircleAlert /><AlertTitle>{text}</AlertTitle></Alert>;
export const Done = ({ text }: { text: string }) => <Alert variant="info"><CircleCheck /><AlertTitle>{text}</AlertTitle></Alert>;
export const GrantCard = ({ title, slot, children }: { title: string; slot: string; children: React.ReactNode }) => (
  <Card data-slot={slot} className="h-full"><CardHeader><CardTitle><h2 className="text-base font-semibold">{title}</h2></CardTitle></CardHeader><CardContent className="flex flex-col items-start gap-4">{children}</CardContent></Card>
);

/** "Add one grant" card: labels above inputs, `Required` in text, a helper sentence under every field (DS-24), inline errors; both in aria-describedby; focus on the first invalid field. */
export function FoundationForm() {
  const router = useRouter(), formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<RowError[]>([]), [saved, setSaved] = useState<string | null>(null), [failure, setFailure] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const show = (errs: RowError[]) => { setErrors(errs); formRef.current?.querySelector<HTMLInputElement>(`[name="${errs[0]?.column}"]`)?.focus(); };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFailure(null); setBusy(true);
    const row = Object.fromEntries(new FormData(e.currentTarget).entries()) as FoundationInput, v = validateFoundation(row);
    if (!v.ok) { setBusy(false); return show(v.errors); }
    const res = await postFoundation({ mode: "manual", row }), body = (await res.json().catch(() => ({}))) as { errors?: RowError[]; error?: string };
    setBusy(false);
    if (res.status === 422 && body.errors) show(body.errors); else if (!res.ok) setFailure(saveFailure(res.status, body.error)); else { setErrors([]); setSaved(v.ok.title); router.refresh(); }
  }

  if (saved !== null) return <GrantCard title="Add one grant" slot="foundation-form"><Done text={`Saved ${saved}`} /><Button type="button" variant="outline" onClick={() => setSaved(null)}>Add another</Button></GrantCard>;
  return (
    <GrantCard title="Add one grant" slot="foundation-form">
      <form ref={formRef} noValidate onSubmit={submit} className="flex w-full flex-col gap-4">
        {errors.length > 0 ? <Problem text={`${errors.length} ${errors.length === 1 ? "field needs" : "fields need"} attention`} /> : null}
        {failure ? <Problem text={failure} /> : null}
        {FOUNDATION_FIELDS.map((f) => {
          const id = `fo-${f.key}`, err = errors.find((e) => e.column === f.key)?.message, help = formHelp(f.key);
          const describedBy = [help && `${id}-hint`, err && `${id}-err`].filter(Boolean).join(" ") || undefined;
          return <div key={f.key} data-slot="form-field">
              <Label htmlFor={id}>{f.label}{f.required ? <span className="text-muted-foreground"> (Required)</span> : null}</Label>
              <Input id={id} name={f.key} inputMode={f.type === "money" ? "decimal" : undefined} aria-invalid={err ? true : undefined} aria-describedby={describedBy} />
              {help ? <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">{help}</p> : null}
              {err ? <p id={`${id}-err`} className="mt-1 flex items-center gap-1 text-sm text-destructive"><CircleAlert className="size-4" aria-hidden />{err}</p> : null}
            </div>;
        })}
        <Button type="submit" loading={busy}>Save opportunity</Button>
      </form>
    </GrantCard>
  );
}
