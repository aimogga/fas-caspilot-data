import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDevGalleryEnabled } from "./dev-gallery";

const read = (rel: string) => readFileSync(join(import.meta.dirname, "..", rel), "utf8");

describe("DS-01b", () => {
  it("pins exact shadcn packages", () => {
    const pkg = JSON.parse(read("package.json"));
    const d = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(d["class-variance-authority"]).toBe("0.7.1");
    expect(d.clsx).toBe("2.1.1");
    expect(d["tailwind-merge"]).toBe("3.7.0");
    expect(d["radix-ui"]).toBe("1.7.0");
    expect(d["lucide-react"]).toBe("1.55.0");
  });

  it("shows the gallery in preview and 404s on Vercel production", () => {
    expect(isDevGalleryEnabled("development")).toBe(true);
    expect(isDevGalleryEnabled("production", "preview")).toBe(true);
    expect(isDevGalleryEnabled("production", "production")).toBe(false);
    expect(isDevGalleryEnabled("development", "production")).toBe(false);
    expect(isDevGalleryEnabled("production")).toBe(false);
    expect(read("app/(dev)/ui/page.tsx")).toMatch(/isDevGalleryEnabled|notFound/);
  });

  it("applies the documented hand-edits", () => {
    const [button, input, label, badge, alert] = ["button", "input", "label", "badge", "alert"].map((f) => read(`components/ui/${f}.tsx`));
    expect(button).toContain('default: "h-11');
    expect(button).toMatch(/lg:h-10[\s\S]*sm: "h-11[\s\S]*lg:h-8[\s\S]*lg: "h-11[\s\S]*size-11 lg:size-10[\s\S]*loading/);
    expect(input).toMatch(/h-12 md:h-11[\s\S]*w-full[\s\S]*text-base/);
    expect(input).not.toMatch(/(?<!file:)text-sm/);
    expect(label).toMatch(/mb-2[\s\S]*\bblock\b/);
    expect(badge).toMatch(/success:[\s\S]*warning:[\s\S]*destructive:[\s\S]*info:[\s\S]*muted:/);
    expect(badge).toContain("success-soft");
    expect(badge).toContain("prefix");
    expect(alert).toContain("warning:");
    expect(alert).toContain('variant === "destructive" ? "alert"');
  });
});
