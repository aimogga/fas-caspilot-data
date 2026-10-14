"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { NeedNeighbors } from "@/lib/need-map/neighbors";

/** Arrow key → direction in SVG space (y grows downward). */
const ANGLES: Record<string, number> = { ArrowRight: 0, ArrowDown: 90, ArrowLeft: 180, ArrowUp: 270 };
const fipsOf = (t: EventTarget | null) => (t instanceof Element ? t.closest("path[data-fips]")?.getAttribute("data-fips") ?? null : null);

/** Event wiring for the server-rendered map: click, Enter or Space select (`?county=`), arrows move focus to a neighbour, Esc clears. */
export function MapSelect({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  function select(fips: string | null) {
    const next = new URLSearchParams(params.toString());
    if (fips) next.set("county", fips);
    else next.delete("county");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  function onClick(e: MouseEvent<HTMLDivElement>) {
    const fips = fipsOf(e.target);
    if (fips) select(fips);
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const fips = fipsOf(e.target);
    if (!fips) return;
    if (e.key === "Enter" || e.key === " ") select(fips);
    else if (e.key === "Escape") select(null);
    else if (Object.hasOwn(ANGLES, e.key)) e.currentTarget.querySelector<SVGPathElement>(`path[data-fips="${NeedNeighbors.toward(fips, ANGLES[e.key])}"]`)?.focus();
    else return;
    e.preventDefault();
  }
  return <div data-slot="map-select" className="contents" onClick={onClick} onKeyDown={onKeyDown}>{children}</div>;
}
