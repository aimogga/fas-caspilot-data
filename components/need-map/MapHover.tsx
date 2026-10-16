"use client";

import { useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import { ExplainBody } from "@/components/trust/explain";
import type { HoverWords } from "@/lib/need-map/words";
import { cardPosition } from "@/lib/trust/layer";

type At = { fips: string; left: number; top: number };
const CARD = "pointer-events-none absolute z-20 w-[20rem] max-w-full rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md";
const fipsOf = (t: EventTarget | null) => (t instanceof Element ? t.closest("path[data-fips]")?.getAttribute("data-fips") ?? null : null);

/** One card for the 29 county paths (DS-11b, D-040): pointer over, keyboard focus and the selected county (so a tap, which selects, shows it) all show the same words,
 * positioned from the path's box and kept inside the figure. The card has no role: the path's `aria-label` already reads the county, rank and score. */
export function MapHover({ words, selected = null, children }: { words: Record<string, HoverWords>; selected?: string | null; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null), [focus, setFocus] = useState<string | null>(null), [at, setAt] = useState<At | null>(null);
  const fips = hover ?? focus ?? selected;
  // The map sticks from 1024 while the page scrolls, so the card is placed again on scroll and resize: it keeps following the county it describes.
  useLayoutEffect(() => {
    const place = () => {
      const path = fips && root.current?.querySelector(`path[data-fips="${fips}"]`);
      if (!path || !root.current) return setAt(null);
      const next = { fips, ...cardPosition(path.getBoundingClientRect(), root.current.getBoundingClientRect(), card.current?.offsetHeight ?? 0) };
      setAt((prev) => (prev && prev.fips === next.fips && prev.left === next.left && prev.top === next.top ? prev : next));
    };
    place();
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place); window.removeEventListener("resize", place); };
  }, [fips]);
  const onPointerOver = (e: PointerEvent<HTMLDivElement>) => setHover(fipsOf(e.target));
  const onFocus = (e: FocusEvent<HTMLDivElement>) => setFocus(fipsOf(e.target));
  const onBlur = (e: FocusEvent<HTMLDivElement>) => { if (!fipsOf(e.relatedTarget)) setFocus(null); };
  const w = at && words[at.fips];
  return (
    <div ref={root} data-slot="map-hover" className="relative" onPointerOver={onPointerOver} onPointerLeave={() => setHover(null)} onFocus={onFocus} onBlur={onBlur}>
      {children}
      {at && w ? <div ref={card} data-slot="map-hover-card" data-fips={at.fips} className={CARD} style={{ left: at.left, top: at.top }}><ExplainBody term={w.term} rows={w.rows} hidden={w.hidden} /></div> : null}
    </div>
  );
}
