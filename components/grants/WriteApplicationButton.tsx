"use client";

// F-508j: "Write the application" on an approved strategy. Shows progress while the writer drafts each section, then opens the editor.
import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { writeApplication, type GenerateState } from "@/app/(app)/staff/grants/strategy/actions";
import { Button } from "@/components/ui/button";

export function WriteApplicationButton({ strategyId, existing }: { strategyId: string; existing: boolean }) {
  const [state, action, pending] = useActionState<GenerateState, FormData>(writeApplication, null);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="strategyId" value={strategyId} />
      <Button type="submit" disabled={pending}>{pending ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : null}{existing ? "Open the latest application" : "Write the application"}</Button>
      <p role="status" data-slot="application-progress" className="text-sm text-muted-foreground empty:sr-only">
        {pending ? "Writing each section under the funder's headings and checking every citation. This can take a minute or two." : state?.error ?? ""}
      </p>
    </form>
  );
}
