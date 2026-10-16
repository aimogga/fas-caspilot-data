import { Grid, Skeleton } from "@/components/layout";
import { cn } from "@/lib/utils";

/** One row of placeholder cards: `cols` across at ≥ 1024, `n` of them (defaults to `cols`), each `h` tall (a Tailwind height token). */
export type SkeletonBlock = { cols: 1 | 2 | 3; h: string; n?: number };
const PULSE = "motion-reduce:animate-none";

/** The loading face of a main route: header bars, then blocks sized like the page's own cards. One sr-only sentence names the page; the bars are hidden from readers. */
export function PageSkeleton({ page, blocks, eyebrow = true }: { page: string; blocks: SkeletonBlock[]; eyebrow?: boolean }) {
  return (
    <div data-slot="page-skeleton" role="status" className="flex flex-col gap-6">
      <p className="sr-only">Loading {page}. The page appears in a moment.</p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          {eyebrow ? <Skeleton className={cn(PULSE, "h-3 w-24")} /> : null}
          <Skeleton className={cn(PULSE, "h-8 w-2/3 max-w-md")} />
          <Skeleton className={cn(PULSE, "h-4 w-1/2 max-w-sm")} />
        </div>
        {blocks.map((b, i) => (
          <Grid key={i} cols={b.cols}>
            {Array.from({ length: b.n ?? b.cols }, (_, j) => <Skeleton key={j} className={cn(PULSE, "rounded-lg", b.h)} />)}
          </Grid>
        ))}
      </div>
    </div>
  );
}
