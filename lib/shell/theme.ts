/** DS-19 theme helper (pure). The user picks Light, Dark or Match device; the page carries `.dark` on `<html>` and a matching `color-scheme`. */
export type ThemeChoice = "light" | "dark" | "system";
export type Resolved = "light" | "dark";

/** The one localStorage key. Only "light" or "dark" is ever stored; "Match device" removes the key so a new device starts from its own setting. */
export const THEME_KEY = "fas-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string; hint?: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match device", hint: "Follows this device's light or dark setting and changes when it does." },
];

/** A stored value becomes a choice; anything unknown or missing means "Match device". */
export function parseTheme(raw: string | null | undefined): ThemeChoice {
  return raw === "light" || raw === "dark" ? raw : "system";
}

/** What to write to storage: the explicit choice, or null to remove the key. */
export function serialiseTheme(choice: ThemeChoice): string | null {
  return choice === "system" ? null : choice;
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): Resolved {
  return choice === "dark" || (choice === "system" && systemPrefersDark) ? "dark" : "light";
}

/** Writes the resolved theme onto the root element: the `.dark` class Tailwind reads and the `color-scheme` native controls read. */
export function applyTheme(root: HTMLElement, resolved: Resolved): void {
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

/**
 * Runs inline in `<head>` before paint so a dark page never flashes light. Mirrors `parseTheme` + `resolveTheme` + `applyTheme`
 * (the unit test runs this string against a fake window and checks it agrees). `ThemeMenu` takes over after hydration and keeps prints light.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=localStorage.getItem("${THEME_KEY}");
var d=k==="dark"||(k!=="light"&&matchMedia("${DARK_QUERY}").matches);
var h=document.documentElement;h.classList.toggle("dark",d);h.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
