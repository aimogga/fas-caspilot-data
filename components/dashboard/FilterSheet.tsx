"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Below 1024 the filter form lives in a bottom sheet; Radix returns focus to the trigger on close.
 * DS-15a: opening focuses the first select rather than the Info hint beside its label, so the first Escape closes the sheet, not a tooltip. */
export function FilterSheet({ active, children }: { active: number; children: ReactNode }) {
  const [open, setOpen] = useState(false), content = useRef<HTMLDivElement>(null);
  const focusFirstControl = (e: Event) => { const first = content.current?.querySelector<HTMLElement>("select, input"); if (first) { e.preventDefault(); first.focus(); } };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button type="button" variant="outline" data-slot="filters-button" aria-expanded={open} aria-controls="filter-sheet">{active ? `Filters · ${active}` : "Filters"}</Button></SheetTrigger>
      <SheetContent ref={content} id="filter-sheet" side="bottom" onOpenAutoFocus={focusFirstControl} aria-describedby={undefined} className="w-full! max-w-none! bg-background! text-foreground! max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle className="font-serif text-xl">Filter the dashboard</SheetTitle></SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
