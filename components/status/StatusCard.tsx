import type { ReactNode } from "react";
import { FocusHeading } from "./FocusHeading";

type StatusCardProps = {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  footnote?: ReactNode;
  /** Move keyboard focus to the H1 on load (the 403 page; screen plan P0-3). */
  focusTitle?: boolean;
};

export function StatusCard({ icon, eyebrow, title, children, actions, footnote, focusTitle }: StatusCardProps) {
  return (
    <section data-slot="status-card" aria-labelledby="status-title">
      <div data-slot="status-glyph" aria-hidden="true" className="text-muted-foreground [&>svg]:size-10">{icon}</div>
      <p data-slot="status-eyebrow">{eyebrow}</p>
      {focusTitle ? <FocusHeading id="status-title">{title}</FocusHeading> : <h1 id="status-title">{title}</h1>}
      <div data-slot="status-body">{children}</div>
      {actions ? <div data-slot="status-actions">{actions}</div> : null}
      {footnote ? <p data-slot="status-footnote">{footnote}</p> : null}
    </section>
  );
}
