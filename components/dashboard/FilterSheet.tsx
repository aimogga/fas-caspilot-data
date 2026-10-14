"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Below 1024 the filter form lives in a bottom sheet; Radix returns focus to the trigger on close. */
export function FilterSheet({ active, children }: { active: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button type="button" variant="outline" data-slot="filters-button" aria-expanded={open} aria-controls="filter-sheet">{active ? `Filters · ${active}` : "Filters"}</Button></SheetTrigger>
      <SheetContent id="filter-sheet" side="bottom" aria-describedby={undefined} className="w-full! max-w-none! bg-background! text-foreground! max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle className="font-serif text-xl">Filter the dashboard</SheetTitle></SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
