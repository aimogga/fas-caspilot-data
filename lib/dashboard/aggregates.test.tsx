import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AggregateTotals } from "@/components/dashboard/AggregateTotals";
import { aggregateTotals, AggregatesQuery, type AggregateRow } from "@/lib/dashboard/aggregates";

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const row = (metric_code: string, value: number, county_fips: string | null, created_at = "2026-01-20T10:00:00Z"): AggregateRow => ({ metric_code, value, county_fips, created_at });
const ROWS = [
  row("families_served", 9, "49035"), row("families_served", 8, "49049", "2026-02-03T09:00:00Z"), row("episodes_completed", 6, null),
  row("dollars_paid", 4200.5, "49035"), row("not_a_metric", 50, null),
];

describe("F-303 aggregate totals on the Team dashboard", () => {
  it("all counties: adds every entry per metric in the fixed metric order, hides counts under 11, never hides dollars, ignores unknown codes", () => {
    const t = aggregateTotals(ROWS, "all");
    expect(t.lines.map((l) => [l.code, l.entries, l.shown, l.suppressed])).toEqual([
      ["families_served", 2, "17", false], ["episodes_completed", 1, null, true], ["dollars_paid", 1, "$4,200.50", false],
    ]);
    expect([t.entries, t.asOf]).toEqual([4, "Feb 2026"]);
  });
  it("one county: only that county's entries, so 9 families is hidden and the org-wide total is left out", () => {
    const t = aggregateTotals(ROWS, "49035");
    expect(t.lines.map((l) => [l.code, l.shown, l.suppressed])).toEqual([["families_served", null, true], ["dollars_paid", "$4,200.50", false]]);
    expect(t.asOf).toBe("Jan 2026");
  });
  it("no rows: no lines and the date reads as not available", () => {
    expect(aggregateTotals([], "all")).toEqual({ lines: [], entries: 0, asOf: "Not available yet" });
  });
  it("load reads one quarter and returns null on a read error", async () => {
    const calls: unknown[] = [];
    const client = (error: { message: string } | null) => ({ from: (t: string) => ({ select: (c: string) => ({ eq: async (k: string, v: string) => { calls.push([t, c, k, v]); return { data: error ? null : ROWS, error }; } }) }) }) as never;
    expect(await AggregatesQuery.load(client(null), "2026-Q1")).toEqual(ROWS);
    expect(calls[0]).toEqual(["aggregate_submission", "metric_code,value,county_fips,created_at", "period", "2026-Q1"]);
    expect(await AggregatesQuery.load(client({ message: "boom" }), "2026-Q1")).toBeNull();
  });
  it("the card carries the Σ Aggregate badge, hides small counts with the n<11 cell, names the source and date, and has an empty and an error state", () => {
    const full = renderToStaticMarkup(<AggregateTotals totals={aggregateTotals(ROWS, "all")} period="2026-Q1" countyName={null} />);
    expect(full).toContain('aria-label="Aggregate submission"');
    expect((full.match(/data-slot="suppressed"/g) ?? []).length).toBe(1);
    expect(text(full)).toContain("Families served 17");
    expect(text(full)).toContain("FAS aggregate total, entered by staff · Jan–Mar 2026 (Q1), all counties · n 4 · as of Feb 2026");
    const empty = renderToStaticMarkup(<AggregateTotals totals={aggregateTotals([], "49035")} period="2026-Q1" countyName="Salt Lake" />);
    expect(text(empty)).toContain("No totals were entered for Jan–Mar 2026 (Q1) in Salt Lake County. Staff add them on Enter data");
    expect(empty).toContain('href="/staff/entry"');
    expect(text(renderToStaticMarkup(<AggregateTotals totals={null} period="2026-Q1" countyName={null} />))).toContain("Couldn&#x27;t load the entered totals.");
  });
});
