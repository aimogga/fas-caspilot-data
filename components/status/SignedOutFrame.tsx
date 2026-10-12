import type { ReactNode } from "react";
import { Page } from "@/components/layout";
import { Wordmark } from "@/components/shell/ShellFrame";

export function SignedOutFrame({ children }: { children: ReactNode }) {
  return (
    <div data-slot="signed-out">
      <header data-slot="signed-out-bar">
        <Wordmark />
      </header>
      <Page id="main">{children}</Page>
    </div>
  );
}
