"use client";
import { useCallback, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { ExplainBody } from "@/components/trust/explain";
import { term as coreTerm, type Term } from "@/lib/trust/glossary";
import { cardPosition, liveText, nextTarget, type TargetData } from "@/lib/trust/layer";

type Active = { el: HTMLElement; pinned: boolean; left: number; top: number };
const SELECTOR = "[data-term]";
const CARD = "pointer-events-none absolute z-20 w-[20rem] max-w-full rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md";
const dataOf = (el: HTMLElement): TargetData => ({ term: el.dataset.term, value: el.dataset.value, source: el.dataset.source, asof: el.dataset.asof, hidden: el.dataset.hidden });
const targetOf = (t: EventTarget | null) => (t instanceof Element ? (t.closest(SELECTOR) as HTMLElement | null) : null);

/** One explain card for many targets (DS-11a, D-040). Descendants carry `data-term` (+ `data-value`, `data-source`, `data-asof`, `data-hidden`); pointer over or focus shows the card under that target,
 * click or Enter pins it as a dialog, Escape closes it (and returns focus when pinned), arrow keys walk the targets, and a polite live region reads the same words. The words also live in the cells. */
export function ExplainLayer({ terms = {}, className, children }: { terms?: Record<string, Term>; className?: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null), titleId = useId();
  const [active, setActive] = useState<Active | null>(null);
  const show = useCallback((el: HTMLElement, pinned: boolean) => {
    if (!root.current) return;
    const at = cardPosition(el.getBoundingClientRect(), root.current.getBoundingClientRect(), card.current?.offsetHeight ?? 0);
    setActive({ el, pinned, ...at });
  }, []);
  const onPointerOver = (e: PointerEvent<HTMLDivElement>) => { const el = targetOf(e.target); if (el) { if (!active?.pinned) show(el, false); } else if (active && !active.pinned) setActive(null); };
  const onPointerLeave = () => { if (active && !active.pinned) setActive(null); };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => { const el = targetOf(e.target); if (el) show(el, active?.pinned === true && active.el === el); };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => { if (active && !active.pinned && !root.current?.contains(e.relatedTarget as Node | null)) setActive(null); };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = targetOf(e.target);
    if (!el) { if (active?.pinned) setActive(null); return; }
    if (active?.pinned && active.el === el) setActive(null); else show(el, true);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = targetOf(e.target);
    if (e.key === "Escape") { if (active) { e.preventDefault(); setActive(null); if (active.pinned) active.el.focus(); } return; }
    if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); if (active?.pinned && active.el === el) setActive(null); else show(el, true); return; }
    if (e.target instanceof Element && e.target.matches("a, button, input, select, textarea")) return;
    const all = Array.from(root.current?.querySelectorAll<HTMLElement>(SELECTOR) ?? []), next = nextTarget(el ? all.indexOf(el) : -1, e.key, all.length);
    if (next >= 0) { e.preventDefault(); all[next]?.focus(); }
  };
  const d = active ? dataOf(active.el) : null, t = d?.term ? (terms[d.term] ?? coreTerm(d.term)) : null;
  return (
    <div ref={root} data-slot="explain-layer" className={`relative ${className ?? ""}`} onPointerOver={onPointerOver} onPointerLeave={onPointerLeave} onFocus={onFocus} onBlur={onBlur} onClick={onClick} onKeyDown={onKeyDown}>
      {children}
      {active && t && d ? (
        <div ref={card} data-slot="explain-layer-card" data-pinned={active.pinned ? "true" : undefined} role={active.pinned ? "dialog" : undefined} aria-labelledby={active.pinned ? titleId : undefined}
          className={`${CARD} ${active.pinned ? "pointer-events-auto" : ""}`} style={{ left: active.left, top: active.top }}>
          <ExplainBody term={t} titleId={titleId} value={d.value} source={d.source} asOf={d.asof} hidden={d.hidden} />
        </div>
      ) : null}
      <span aria-live="polite" className="sr-only">{active && t && d ? liveText(t, d) : ""}</span>
    </div>
  );
}
