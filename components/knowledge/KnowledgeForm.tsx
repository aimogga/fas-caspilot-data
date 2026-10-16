"use client";
import { startTransition, useActionState, useEffect, useId, useRef, type FormEvent } from "react";
import { saveEntry, setStatus, type ActionState } from "@/app/(app)/admin/knowledge/actions";
import { FormField } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES } from "@/lib/knowledge/guard";
import type { Status } from "@/lib/knowledge/store";
import { CATEGORY_LABEL, CONFIRM_LABEL, type ListRow } from "@/lib/knowledge/view";

const Message = ({ state }: { state: ActionState }) => <p role="status" data-slot="knowledge-message" className={state && !state.ok ? "text-destructive" : "text-muted-foreground"}>{state?.message ?? ""}</p>;

/** Submit without React's automatic form reset, so a refused entry keeps the admin's typing; a successful add clears the form. */
function useSubmit(action: (s: ActionState, f: FormData) => Promise<ActionState>, resetOnOk: boolean) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnOk) ref.current?.reset(); }, [state, resetOnOk]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter); startTransition(() => run(data)); };
  return { state, pending, ref, onSubmit };
}

/** Add (no row) or edit (row). Category, title, body, source, as-of and the required privacy checkbox. */
export function KnowledgeForm({ row }: { row?: ListRow }) {
  const { state, pending, ref, onSubmit } = useSubmit(saveEntry, !row), k = useId();
  return (
    <form ref={ref} onSubmit={onSubmit} data-slot="knowledge-form" className="flex min-w-0 flex-col gap-4">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormField label="Category" htmlFor={`${k}-category`}>
        <select id={`${k}-category`} name="category" defaultValue={row?.category ?? "mission"}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
      </FormField>
      <FormField label="Title" htmlFor={`${k}-title`}><Input id={`${k}-title`} name="title" required maxLength={200} defaultValue={row?.title} /></FormField>
      <FormField label="Text the grant writer may use" htmlFor={`${k}-body`}>
        <textarea id={`${k}-body`} name="body" required rows={5} maxLength={8000} defaultValue={row?.body} className="min-h-32 rounded-md border border-input bg-transparent p-3 text-base" />
      </FormField>
      <FormField label="Source (needed for numbers in outcomes and budget)" htmlFor={`${k}-source`}><Input id={`${k}-source`} name="source" defaultValue={row?.source ?? ""} /></FormField>
      <FormField label="As of" htmlFor={`${k}-asof`}><Input id={`${k}-asof`} name="as_of" type="date" defaultValue={row?.as_of ?? ""} /></FormField>
      <label className="flex min-h-11 items-center gap-3 text-base"><input type="checkbox" name="confirm" value="yes" required className="size-5 shrink-0" />{CONFIRM_LABEL}</label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{row ? "Save as new draft" : "Add as draft"}</Button>
        {row ? <span className="text-sm text-muted-foreground">Saving puts the entry back in draft until it is approved again.</span> : null}
      </div>
      <Message state={state} />
    </form>
  );
}

const NEXT: Record<Status, [Status, string][]> = {
  draft: [["approved", "Approve"], ["archived", "Archive"]], approved: [["draft", "Return to draft"], ["archived", "Archive"]], archived: [["draft", "Restore as draft"]],
};
/** Approve, return to draft, archive: one form, the pressed button names the new status. No delete. */
export function StatusActions({ row }: { row: ListRow }) {
  const { state, pending, onSubmit } = useSubmit(setStatus, false);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={row.id} />
      <div className="flex flex-wrap gap-3">
        {NEXT[row.status].map(([status, label]) => (
          <Button key={status} type="submit" name="status" value={status} variant={status === "approved" ? "default" : "outline"} disabled={pending} aria-label={`${label}: ${row.title}`}>{label}</Button>
        ))}
      </div>
      <Message state={state} />
    </form>
  );
}
