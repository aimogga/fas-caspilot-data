"use client";

import { Check } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { applyTheme, DARK_QUERY, parseTheme, resolveTheme, serialiseTheme, THEME_KEY, THEME_OPTIONS, type ThemeChoice } from "@/lib/shell/theme";

const read = (): ThemeChoice => {
  try { return parseTheme(window.localStorage.getItem(THEME_KEY)); } catch { return "system"; }
};
// The stored choice as an external store: the server snapshot is "Match device", so hydration never disagrees with the boot script's class.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const write = (next: ThemeChoice) => {
  const stored = serialiseTheme(next);
  try {
    if (stored) window.localStorage.setItem(THEME_KEY, stored); else window.localStorage.removeItem(THEME_KEY);
  } catch { /* private mode: the choice lasts for this page only */ }
  for (const fn of listeners) fn();
};
const prefersDark = () => window.matchMedia(DARK_QUERY).matches;
const printing = () => window.matchMedia("print").matches;

// 44 px rows below 1024; the chosen row carries aria-pressed and a tick so the state is never colour alone.
const ROW = "flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground lg:min-h-9";
const ON = "aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium";

/** DS-19: three pressed buttons in the account menu. The choice lives in localStorage; "Match device" follows the device live and prints stay light. */
export function ThemeMenu() {
  const choice = useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);
  useEffect(() => {
    const root = document.documentElement;
    const paint = () => applyTheme(root, printing() ? "light" : resolveTheme(choice, prefersDark()));
    paint();
    const queries = [window.matchMedia(DARK_QUERY), window.matchMedia("print")];
    for (const q of queries) q.addEventListener("change", paint);
    window.addEventListener("beforeprint", paint);
    window.addEventListener("afterprint", paint);
    return () => {
      for (const q of queries) q.removeEventListener("change", paint);
      window.removeEventListener("beforeprint", paint);
      window.removeEventListener("afterprint", paint);
    };
  }, [choice]);
  return (
    <div data-slot="theme-menu" role="group" aria-labelledby="theme-menu-label" className="flex flex-col gap-1 border-t pt-2">
      <p id="theme-menu-label" className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
      {THEME_OPTIONS.map((o) => (
        <button key={o.value} type="button" data-slot="theme-option" data-theme={o.value} aria-pressed={choice === o.value} aria-describedby={o.hint ? `theme-hint-${o.value}` : undefined} onClick={() => write(o.value)} className={`${ROW} ${ON}`}>
          <Check aria-hidden className={`size-4 shrink-0 ${choice === o.value ? "" : "invisible"}`} />
          <span className="flex flex-col"><span>{o.label}</span>{o.hint ? <span id={`theme-hint-${o.value}`} className="text-xs font-normal text-muted-foreground">{o.hint}</span> : null}</span>
        </button>
      ))}
    </div>
  );
}
