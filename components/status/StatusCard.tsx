import type { ReactNode } from "react";

type StatusCardProps = {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  footnote?: ReactNode;
};

export function StatusCard({ icon, eyebrow, title, children, actions, footnote }: StatusCardProps) {
  return (
    <section data-slot="status-card" aria-labelledby="status-title">
      <div data-slot="status-icon" aria-hidden="true">{icon}</div>
      <p data-slot="status-eyebrow">{eyebrow}</p>
      <h1 id="status-title">{title}</h1>
      <div data-slot="status-body">{children}</div>
      {actions ? <div data-slot="status-actions">{actions}</div> : null}
      {footnote ? <p data-slot="status-footnote">{footnote}</p> : null}
    </section>
  );
}
