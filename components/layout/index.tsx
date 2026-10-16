"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const GAPS = { 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 6: "gap-6", 8: "gap-8", 12: "gap-12", 16: "gap-16" } as const;
export type Gap = keyof typeof GAPS;

export function Page({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return <main id={id} data-slot="page" className={cn(className)}>{children}</main>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header data-slot="page-header">
      {eyebrow ? <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions ? <div data-slot="actions">{actions}</div> : null}
    </header>
  );
}

export function Stack({ gap = 4, children, className }: { gap?: Gap; children: ReactNode; className?: string }) {
  return <div data-slot="stack" className={cn("flex min-w-0 flex-col [&>*]:min-w-0", GAPS[gap], className)}>{children}</div>;
}

export function Cluster({ gap = 4, children, className }: { gap?: Gap; children: ReactNode; className?: string }) {
  return <div data-slot="cluster" className={cn("flex min-w-0 flex-wrap [&>*]:min-w-0", GAPS[gap], className)}>{children}</div>;
}

export function Grid({ cols = 1, children, className }: { cols?: 1 | 2 | 3 | 4; children: ReactNode; className?: string }) {
  return (
    <div data-slot="grid" data-cols={cols} className={cn("grid min-w-0 grid-cols-1 gap-3 [&>*]:min-w-0", cols >= 2 && "md:grid-cols-2", cols === 3 && "lg:grid-cols-3", cols === 4 && "lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return <section data-slot="section" className="flex flex-col gap-4">{title ? <h2 className="font-serif text-xl font-semibold">{title}</h2> : null}{children}</section>;
}

export function EmptyState({ icon, title, children, action, headingLevel = "h2" }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; headingLevel?: "h2" | "h3" | "h4" }) {
  const Heading = headingLevel;
  return <div data-slot="empty-state">{icon}<Heading className="text-xl font-semibold">{title}</Heading>{children ? <p>{children}</p> : null}{action}</div>;
}

export function ErrorState({ message, referenceId, onRetry, href, children }: { message: string; referenceId: string; onRetry?: () => void; href?: string; children?: ReactNode }) {
  const retry = href ? <a href={href} className={buttonVariants({ variant: "outline" })}>Try again</a> : onRetry ? <Button type="button" variant="outline" onClick={onRetry}>Try again</Button> : null;
  return (
    <Alert variant="destructive" data-slot="error-state">
      <CircleAlert />
      <AlertTitle>{message}</AlertTitle>
      <AlertDescription>
        {children ? <p>{children}</p> : null}
        <p className="font-mono text-xs">Reference {referenceId}</p>
        {retry}
      </AlertDescription>
    </Alert>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div data-slot="skeleton" aria-hidden className={cn("h-4 animate-pulse rounded-md bg-muted", className)} />;
}

export function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div data-slot="form-field"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

export function ResponsiveTable({ stack = false, children }: { stack?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || stack) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stack]);
  return (
    // A scroller that actually overflows must be reachable from the keyboard (axe scrollable-region-focusable), so it becomes a named, focusable region.
    <div ref={ref} data-slot={stack ? "table-stack" : "table-scroll"} tabIndex={overflow ? 0 : undefined} role={overflow ? "region" : undefined} aria-label={overflow ? "Table, scrolls sideways" : undefined}>
      {stack || !overflow ? null : <p className="scroll-hint"><span aria-hidden>Scroll →</span><span className="sr-only">Scroll</span></p>}
      <table>{children}</table>
    </div>
  );
}
