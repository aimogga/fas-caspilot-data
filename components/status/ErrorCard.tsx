"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusCard } from "./StatusCard";

export function ErrorCard({ digest, reset }: { digest?: string; reset: () => void }) {
  return (
    <StatusCard
      icon={<TriangleAlert />}
      eyebrow="Error 500 · Something went wrong"
      title="This page didn't load"
      actions={
        <>
          <Button type="button" onClick={reset}>Try again</Button>
          <Link data-slot="button" className={buttonVariants({ variant: "outline" })} href="/">Go to your home</Link>
        </>
      }
      footnote={<>Reference: <code>{digest ?? "not available"}</code></>}
    >
      <p>Something went wrong on our side. Try again. If it keeps happening, share the reference with your FAS admin.</p>
    </StatusCard>
  );
}
