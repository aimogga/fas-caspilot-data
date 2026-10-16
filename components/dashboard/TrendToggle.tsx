"use client";
import { Info } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Hint } from "@/components/trust/explain";
import { buttonVariants } from "@/components/ui/button";
import { TABLE_HINT } from "@/lib/dashboard/words";
import { cn } from "@/lib/utils";
/** `View as table` toggle for a trend line; the chart and the table are rendered on the server and passed in.
 * DS-15b: an Info hint beside the toggle says what the table shows; the hint never prints (the toggle is already hidden in print). */
export function TrendToggle({ children, table }: { children: ReactNode; table: ReactNode }) {
  const [open, setOpen] = useState(false), id = useId();
  return (
    <div data-slot="trend-line" className="flex flex-col gap-2">{children}
      <div className="flex items-center gap-1 self-start">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>View as table</button>
        <span className="print:hidden"><Hint text={TABLE_HINT} label="About the table view" className="w-11 shrink-0 lg:w-auto"><Info aria-hidden className="size-4 text-muted-foreground" /></Hint></span>
      </div>
      {open ? <div id={id}>{table}</div> : null}
    </div>
  );
}
