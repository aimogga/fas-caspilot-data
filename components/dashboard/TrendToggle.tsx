"use client";
import { useId, useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/** `View as table` toggle for a trend line; the chart and the table are rendered on the server and passed in. */
export function TrendToggle({ children, table }: { children: ReactNode; table: ReactNode }) {
  const [open, setOpen] = useState(false), id = useId();
  return (
    <div data-slot="trend-line" className="flex flex-col gap-2">{children}
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start")}>View as table</button>
      {open ? <div id={id}>{table}</div> : null}
    </div>
  );
}
