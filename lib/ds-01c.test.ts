import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { FreshnessChip, SourceFooter, type SourceFooterProps, SuppressedCell } from "@/components/trust";

const read = (rel: string) => readFileSync(join(import.meta.dirname, "..", rel), "utf8");
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("DS-01c", () => {
  it("SuppressedCell never renders a number", () => {
    for (const count of [3, 7, 10]) {
      const markup = html(createElement(SuppressedCell, { count }));
      expect(markup).not.toContain(String(count));
      expect(markup).toMatch(/—|–|-/);
      expect(markup).toMatch(/n&lt;11|n<11/);
    }
  });

  it("FreshnessChip always renders text", () => {
    for (const status of ["current", "stale", "failed"] as const) {
      const text = html(createElement(FreshnessChip, { status })).replace(/<[^>]+>/g, "");
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).toMatch(/Current|Stale|Failed/);
    }
  });

  it("SourceFooter requires an as-of date", () => {
    expectTypeOf<SourceFooterProps>().toHaveProperty("asOf").toEqualTypeOf<string>();
    type Optional = Partial<Pick<SourceFooterProps, "asOf">> extends Pick<SourceFooterProps, "asOf"> ? true : false;
    expectTypeOf<Optional>().toEqualTypeOf<false>();
    expect(html(createElement(SourceFooter, { source: "ACS", period: "2024", n: 42, asOf: "2024-06" }))).toContain("2024-06");
  });

  it("moves side padding from body to the page container and lists primitives in the gallery", () => {
    const css = read("app/globals.css");
    expect(css).not.toMatch(/body\s*\{[^}]*padding-inline:\s*var\(--page-gutter-mobile\)/);
    expect(css).toContain("[data-slot=page]");
    expect(css).toContain("var(--page-gutter-mobile)");
    expect(read("components/layout/index.tsx") + read("components/trust/index.tsx")).not.toMatch(/style=\{\{/);
    const gallery = read("app/(dev)/ui/page.tsx");
    for (const name of ["PageHeader", "EmptyState", "ErrorState", "SourceFooter", "SuppressedCell", "FreshnessChip", "NotPublished", "DraftBanner", "ResponsiveTable", "FormField"]) expect(gallery).toContain(name);
  });
});
