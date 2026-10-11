import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { EmptyState, ErrorState } from "@/components/layout";
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
      const markup = html(createElement(FreshnessChip, { status }));
      const text = markup.replace(/<[^>]+>/g, "");
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).toMatch(/Current|Stale|Failed/);
      expect(markup).toMatch(/aria-hidden/);
    }
  });

  it("ErrorState uses the destructive Alert with its status icon", () => {
    const markup = html(createElement(ErrorState, { message: "Ingest failed.", referenceId: "run_demo" }));
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("text-destructive");
    expect(markup).toContain("data-slot=\"alert-title\"");
    expect(markup).toContain("Ingest failed.");
    expect(markup).toMatch(/<svg/);
    expect(markup).not.toMatch(/Retry|<button|<a /);
    expect(html(createElement(ErrorState, { message: "Ingest failed.", referenceId: "run_demo", href: "/ui" }))).toContain("Retry");
  });

  it("EmptyState heading defaults to h2", () => {
    expect(html(createElement(EmptyState, { title: "No uploads yet" }, "Upload your first case file."))).toContain("<h2");
    expect(html(createElement(EmptyState, { title: "No uploads yet", headingLevel: "h3" }, "Upload your first case file."))).toContain("<h3");
  });

  it("SourceFooter requires an as-of date", () => {
    expectTypeOf<SourceFooterProps>().toHaveProperty("asOf").toEqualTypeOf<string>();
    type Optional = Partial<Pick<SourceFooterProps, "asOf">> extends Pick<SourceFooterProps, "asOf"> ? true : false;
    expectTypeOf<Optional>().toEqualTypeOf<false>();
    expect(html(createElement(SourceFooter, { source: "ACS", period: "2024", n: 42, asOf: "2024-06" }))).toContain("2024-06");
  });

  it("keeps Page on the gallery only and lists primitives", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/body\s*\{[^}]*padding-inline:\s*var\(--page-gutter-mobile\)/);
    expect(css).toContain("[data-slot=page]");
    expect(css).not.toMatch(/\[data-slot=card\]\s*\{/);
    expect(css).toContain("[data-slot=card][data-pad]");
    expect(css).toContain("[data-slot=page-header] [data-slot=actions] > * { width: 100%");
    expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*\[data-slot=actions\][\s\S]*width: auto/);
    expect(read("components/layout/index.tsx") + read("components/trust/index.tsx")).not.toMatch(/style=\{\{/);
    for (const rel of ["app/login/page.tsx", "app/403/page.tsx", "components/PageLayout.tsx"]) expect(read(rel)).not.toContain("components/layout");
    const gallery = read("app/(dev)/ui/page.tsx");
    for (const name of ["PageHeader", "EmptyState", "ErrorState", "SourceFooter", "SuppressedCell", "FreshnessChip", "NotPublished", "DraftBanner", "ResponsiveTable", "FormField"]) expect(gallery).toContain(name);
  });
});
