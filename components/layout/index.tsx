import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const GAPS = { 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 6: "gap-6", 8: "gap-8", 12: "gap-12", 16: "gap-16" } as const;
export type Gap = keyof typeof GAPS;

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main data-slot="page" className={cn(className)}>{children}</main>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
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

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div data-slot="empty-state">{icon}<h3 className="text-xl font-semibold">{title}</h3><p>{children}</p>{action}</div>;
}

export function ErrorState({ message, referenceId, retry }: { message: string; referenceId: string; retry?: ReactNode }) {
  return (
    <div data-slot="error-state" role="alert">
      <p>{message}</p>
      <p className="font-mono text-xs">Reference {referenceId}</p>
      {retry ?? <button type="button">Retry</button>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div data-slot="skeleton" aria-hidden className={cn("h-4 animate-pulse rounded-md bg-muted", className)} />;
}

export function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div data-slot="form-field"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

export function ResponsiveTable({ stack = false, children }: { stack?: boolean; children: ReactNode }) {
  return (
    <div data-slot={stack ? "table-stack" : "table-scroll"}>
      {stack ? null : <p className="scroll-hint">Scroll →</p>}
      <table>{children}</table>
    </div>
  );
}
