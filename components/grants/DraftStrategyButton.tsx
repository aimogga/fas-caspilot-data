"use client";

// F-508f: "Draft a response strategy" on a match. Shows progress while the server drafts and checks citations, then opens the stored draft.
import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { generateStrategy, type GenerateState } from "@/app/(app)/staff/grants/strategy/actions";
import { Button } from "@/components/ui/button";

export function DraftStrategyButton({ opportunityId }: { opportunityId: string }) {
  const [state, action, pending] = useActionState<GenerateState, FormData>(generateStrategy, null);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Button type="submit" size="sm" disabled={pending}>{pending ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : null}Draft a response strategy</Button>
      <p role="status" data-slot="draft-progress" className="text-sm text-muted-foreground">
        {pending ? "Drafting from stored rows and checking every citation. This can take up to a minute." : state?.error ?? ""}
      </p>
    </form>
  );
}
