"use client";

import { ErrorCard } from "@/components/status/ErrorCard";
import { SignedOutFrame } from "@/components/status/SignedOutFrame";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <SignedOutFrame>
      <ErrorCard digest={error.digest} reset={reset} />
    </SignedOutFrame>
  );
}
