import { describe, expect, it } from "vitest";
import { applyTheme, DARK_QUERY, parseTheme, resolveTheme, serialiseTheme, THEME_BOOT_SCRIPT, THEME_KEY, THEME_OPTIONS } from "./theme";

/** A root element stand-in: the class list and the inline style the script and `applyTheme` write. */
function fakeRoot() {
  const classes = new Set<string>();
  return {
    classes,
    style: { colorScheme: "" },
    classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)), contains: (c: string) => classes.has(c) },
  };
}

/** Runs the inline boot script against a fake window and returns what it wrote to the root. */
function boot(stored: string | null, systemDark: boolean) {
  const root = fakeRoot();
  const fn = new Function("localStorage", "matchMedia", "document", THEME_BOOT_SCRIPT);
  fn({ getItem: (k: string) => (k === THEME_KEY ? stored : null) }, (q: string) => ({ matches: q === DARK_QUERY && systemDark }), { documentElement: root });
  return { dark: root.classes.has("dark"), scheme: root.style.colorScheme };
}

describe("theme helper (DS-19)", () => {
  it("parses only light and dark; anything else means Match device", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const raw of [null, undefined, "", "system", "DARK", "blue"]) expect(parseTheme(raw)).toBe("system");
  });

  it("stores light and dark and removes the key for Match device", () => {
    expect(serialiseTheme("light")).toBe("light");
    expect(serialiseTheme("dark")).toBe("dark");
    expect(serialiseTheme("system")).toBeNull();
    for (const o of THEME_OPTIONS) expect(parseTheme(serialiseTheme(o.value))).toBe(o.value);
  });

  it("resolves: explicit choices ignore the device, Match device follows it", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("applyTheme sets the class and color-scheme together, and clears both", () => {
    const root = fakeRoot();
    applyTheme(root as unknown as HTMLElement, "dark");
    expect([root.classes.has("dark"), root.style.colorScheme]).toEqual([true, "dark"]);
    applyTheme(root as unknown as HTMLElement, "light");
    expect([root.classes.has("dark"), root.style.colorScheme]).toEqual([false, "light"]);
  });

  it("the no-flash boot script agrees with resolveTheme for every stored value and device setting", () => {
    for (const stored of [null, "light", "dark", "nonsense"]) {
      for (const systemDark of [false, true]) {
        const want = resolveTheme(parseTheme(stored), systemDark);
        expect(boot(stored, systemDark), `${stored} / device dark ${systemDark}`).toEqual({ dark: want === "dark", scheme: want });
      }
    }
  });

  it("the boot script is small, has no dependencies and survives a blocked localStorage", () => {
    expect(THEME_BOOT_SCRIPT.split("\n").length).toBeLessThanOrEqual(15);
    expect(THEME_BOOT_SCRIPT).not.toMatch(/import|require/);
    const root = fakeRoot();
    const fn = new Function("localStorage", "matchMedia", "document", THEME_BOOT_SCRIPT);
    expect(() => fn({ getItem: () => { throw new Error("blocked"); } }, () => ({ matches: true }), { documentElement: root })).not.toThrow();
  });

  it("menu copy is sentence case with a plain hint on Match device only", () => {
    expect(THEME_OPTIONS.map((o) => o.label)).toEqual(["Light", "Dark", "Match device"]);
    for (const o of THEME_OPTIONS) expect(o.hint ?? "").not.toMatch(/!|N\/A|CasePilot|emoji/i);
    expect(THEME_OPTIONS.find((o) => o.value === "system")?.hint).toMatch(/device/);
  });
});
