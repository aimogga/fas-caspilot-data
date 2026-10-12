"use client";

import { ErrorCard } from "@/components/status/ErrorCard";
import { ErrorFrame } from "@/components/status/ErrorFrame";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorFrame>
      <ErrorCard digest={error.digest} reset={reset} />
    </ErrorFrame>
  );
}
