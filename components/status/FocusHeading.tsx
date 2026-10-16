"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** The status-page H1: it takes focus on load so a screen reader starts at the answer (screen plan P0-3). */
export function FocusHeading({ id, children }: { id?: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return <h1 id={id} ref={ref} tabIndex={-1} data-slot="focus-heading" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{children}</h1>;
}
