"use client";

import "./globals.css";
import { ErrorCard } from "@/components/status/ErrorCard";
import { SignedOutFrame } from "@/components/status/SignedOutFrame";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <SignedOutFrame>
          <ErrorCard digest={error.digest} reset={reset} />
        </SignedOutFrame>
      </body>
    </html>
  );
}
