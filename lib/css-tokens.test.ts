import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

describe("design tokens", () => {
  it("pins Tailwind v4 and tw-animate-css without caret ranges", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies.tailwindcss).toBe("4.3.3");
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toBe("4.3.3");
    expect(pkg.devDependencies["tw-animate-css"]).toBe("1.4.0");
  });

  it("defines the FAS Evidence primary token", () => {
    const css = readFileSync(join(root, "app/globals.css"), "utf8");
    expect(css).toContain("--primary: oklch(0.38 0.06 160)");
    expect(css).toContain("--tap-min: 44px");
    expect(css).toContain("--input-font: 16px");
    expect(css).toContain("--page-gutter-mobile: 16px");
    expect(css).toContain("--breakpoint-md: 768px");
    expect(css).toContain("--breakpoint-lg: 1024px");
  });

  it("has no raw hex in app CSS", () => {
    for (const file of cssFiles(join(root, "app"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(HEX);
    }
  });
});
