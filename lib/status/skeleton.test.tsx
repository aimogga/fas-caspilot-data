import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageSkeleton } from "@/components/status/PageSkeleton";
import { StatusCard } from "@/components/status/StatusCard";

const ROUTES = ["staff", "dashboard", "need-map", "board", "staff/grants/matches", "staff/intake", "staff/entry", "admin", "staff/grants"]; // DS-14 five + DS-18a one + DS-18b two + DS-24 one

describe("DS-14 loading skeletons and status card", () => {
  it("PageSkeleton is a status region with one sr-only sentence, hidden bars sized by the blocks, and no pulse under reduced motion", () => {
    const m = renderToStaticMarkup(<PageSkeleton page="the board summary" blocks={[{ cols: 3, h: "h-32" }, { cols: 1, h: "h-28", n: 5 }]} />);
    expect(m).toMatch(/<div data-slot="page-skeleton" role="status"/);
    expect(m).toContain('<p class="sr-only">Loading the board summary. The page appears in a moment.</p>');
    expect(m).toMatch(/<div aria-hidden="true"/);
    expect((m.match(/data-slot="skeleton"/g) ?? []).length).toBe(3 + 3 + 5);
    expect((m.match(/h-32/g) ?? []).length).toBe(3);
    expect((m.match(/motion-reduce:animate-none/g) ?? []).length).toBe(11);
    expect(m).toContain('data-cols="3"');
  });
  it("the main routes (and the DS-18 upload, entry and admin pages) ship a loading.tsx", () => {
    for (const r of ROUTES) expect(existsSync(`${import.meta.dirname}/../../app/(app)/${r}/loading.tsx`), r).toBe(true);
  });
  it("StatusCard renders the 40 px glyph pattern and, with focusTitle, a focusable H1", () => {
    const m = renderToStaticMarkup(<StatusCard icon={<svg />} eyebrow="Error 403 · No permission" title="You don't have access to staff tools" focusTitle><p>Body</p></StatusCard>);
    expect(m).toMatch(/data-slot="status-glyph" aria-hidden="true" class="[^"]*size-10/);
    expect(m).toMatch(/<h1 id="status-title" tabindex="-1" data-slot="focus-heading"/);
    expect(m).not.toContain("logged");
  });
});
