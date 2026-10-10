import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDevGalleryEnabled } from "./dev-gallery";

const read = (rel: string) => readFileSync(join(import.meta.dirname, "..", rel), "utf8");
const ui = (f: string) => read(`components/ui/${f}.tsx`);

describe("DS-01b", () => {
  it("pins packages, uses @/lib/utils cn, gates /ui, and applies hand-edits", () => {
    const d = { ...JSON.parse(read("package.json")).dependencies, ...JSON.parse(read("package.json")).devDependencies };
    expect(d).toMatchObject({ "class-variance-authority": "0.7.1", clsx: "2.1.1", cn: "0.4.0", "tailwind-merge": "3.7.0", "radix-ui": "1.7.0", "lucide-react": "1.55.0" });
    for (const f of ["button", "input", "label", "badge", "alert"]) expect(ui(f)).toContain('from "@/lib/utils"');
    expect(ui("card")).toContain('from "cn"');
    expect(ui("separator")).toContain('from "cn"');
    expect([isDevGalleryEnabled("development"), isDevGalleryEnabled("production", "preview"), isDevGalleryEnabled("production", "production"), isDevGalleryEnabled("development", "production"), isDevGalleryEnabled("production")]).toEqual([true, true, false, false, false]);
    const [button, input, label, badge, alert, gallery] = ["button", "input", "label", "badge", "alert"].map(ui).concat(read("app/(dev)/ui/page.tsx"));
    expect(gallery).toMatch(/isDevGalleryEnabled|notFound/);
    expect(button).toContain('default: "h-11');
    expect(button).toMatch(/lg:h-10[\s\S]*sm: "h-11[\s\S]*lg:h-8[\s\S]*lg: "h-11[\s\S]*size-11 lg:size-10[\s\S]*loading/);
    expect(button).toContain("var(--ring)");
    expect(input).toMatch(/h-12 md:h-11[\s\S]*w-full[\s\S]*text-base/);
    expect(input).not.toMatch(/(?<!file:)text-sm/);
    expect(label).toMatch(/mb-2[\s\S]*\bblock\b/);
    expect(badge).toMatch(/success:[\s\S]*success-soft[\s\S]*warning:[\s\S]*destructive:[\s\S]*info:[\s\S]*muted:[\s\S]*prefix/);
    expect(alert).toMatch(/warning:[\s\S]*variant === "destructive" \? "alert"/);
    expect(gallery).toMatch(/disabled[\s\S]*aria-invalid[\s\S]*aria-describedby/);
    expect(read("app/globals.css")).toMatch(/button:not\(\[data-slot\]\)[\s\S]*--tap-min[\s\S]*\[data-slot=button\]/);
  });
});
