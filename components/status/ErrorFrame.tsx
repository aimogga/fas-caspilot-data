"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ShellFrame } from "@/components/shell/ShellFrame";
import { roleLabel, syntheticBadgeVisible } from "@/lib/shell/nav";
import { loadErrorViewer, type ErrorViewer } from "./error-viewer";
import { SignedOutFrame } from "./SignedOutFrame";

export function ErrorFrame({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<ErrorViewer | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadErrorViewer().then((next) => {
      if (!cancelled) setViewer(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!viewer) return null;
  if (viewer.signedIn) {
    const role = viewer.role ?? "unknown";
    return (
      <ShellFrame
        role={role}
        roleLabel={roleLabel(role)}
        name="Signed in"
        showSynthetic={syntheticBadgeVisible(process.env.NEXT_PUBLIC_ENV)}
      >
        {children}
      </ShellFrame>
    );
  }
  return <SignedOutFrame>{children}</SignedOutFrame>;
}
