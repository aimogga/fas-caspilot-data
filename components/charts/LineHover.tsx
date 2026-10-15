"use client";
import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { nearestIndex, stepIndex, tooltipText } from "@/lib/charts/hover";
import type { ChartPoint } from "@/lib/charts/scale";
export type HoverPoint = ChartPoint & { x: number; y: number | null };
/** Crosshair + tooltip over the line plot: pointer snaps to the nearest period, arrow keys walk the points when the layer has focus. The text is in the tooltip, never colour alone. */
export function LineHover({ points, unit, noun }: { points: HoverPoint[]; unit: string; noun: string }) {
  const [active, setActive] = useState<number | null>(null), id = useId();
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setActive(nearestIndex(((e.clientX - r.left) / r.width) * 100, points.length));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = stepIndex(active ?? 0, e.key, points.length);
    if (next !== active || ["Home", "End"].includes(e.key)) { e.preventDefault(); setActive(next); }
    if (e.key === "Escape") setActive(null);
  };
  const p = active == null ? null : points[active], flip = p != null && p.x > 60;
  return (
    <div data-slot="line-hover" role="group" tabIndex={0} aria-label={`${noun}: use arrow keys to read each period`} aria-describedby={id} onPointerMove={onMove} onPointerLeave={() => setActive(null)}
      onKeyDown={onKey} onBlur={() => setActive(null)} className="absolute inset-0 cursor-crosshair rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {p ? <>
        <span aria-hidden className="absolute inset-y-0 border-l border-dashed border-muted-foreground" style={{ left: `${p.x}%` }} />
        {p.y != null ? <span aria-hidden className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-chart-1 bg-background" style={{ left: `${p.x}%`, top: `${p.y}%` }} /> : null}
        <span data-slot="tooltip" className={`absolute top-2 z-10 max-w-[12rem] whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm ${flip ? "-translate-x-full" : ""}`}
          style={{ left: `calc(${p.x}% ${flip ? "- 0.5rem" : "+ 0.5rem"})` }}>{tooltipText(p, unit)}</span>
      </> : null}
      <span id={id} aria-live="polite" className="sr-only">{p ? tooltipText(p, unit) : ""}</span>
    </div>
  );
}
