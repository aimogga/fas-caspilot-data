import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import { M4Table } from "@/components/dashboard/M4Table";
import { M6Card } from "@/components/dashboard/M6Card";
import { MetricCard, type MetricCardProps } from "@/components/dashboard/MetricCard";
import { OutcomesCard } from "@/components/dashboard/OutcomesCard";
import { METRIC_CARDS, M4_COLUMNS, M6_COLUMNS, O1_COLUMNS } from "@/lib/dashboard/cards";
import type { M4Result, M6Result, O1Result } from "@/lib/dashboard/metrics-query";

const empty = { data: [], error: null };
type Chain = Promise<typeof empty> & Record<"order" | "limit" | "eq" | "gte" | "lte", () => Chain>;
/** Every table and view read resolves to no rows; `.order/.limit` (widgets) and `.gte/.lte/.eq` (F-304 views) chain. */
const chain = (): Chain => Object.assign(Promise.resolve(empty), { order: chain, limit: chain, eq: chain, gte: chain, lte: chain });
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ select: chain }) }) }));
const footer = { source: "FAS records", period: "Jul–Sep 2026 (Q3)", n: "= 12", asOf: "Sep 2026" };
const page = async (params = {}) => renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve(params) }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ");
const plain = (markup: string) => text(markup).replace(/&lt;/g, "<").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const SUPPRESSED = "— n<11 Suppressed because the count is under 11, to protect privacy.";

describe("DS-07a team dashboard (F-401)", () => {
  it("renders the header and every card in spec order", async () => {
    const markup = await page();
    expect(markup).toContain("<h1");
    expect(markup).toContain("Team dashboard");
    const titles = [...markup.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1]);
    expect(titles).toEqual([
      "Days from court order to first session",
      "Days from application to funding decision",
      "Approved but never started",
      "Cost per completed episode",
      "Completion rate by income band",
      "Where therapy dollars went",
      "Outcome change",
      "Public data freshness",
      "Grant pipeline",
    ]);
  });

  it("each unwired card says Not available yet and shows no number or footer", () => {
    for (const card of METRIC_CARDS) {
      const body = text(renderToStaticMarkup(createElement(MetricCard, { card })));
      expect(body).toContain("Not available yet");
      expect(body).toContain(`This number appears when ${card.metricName} is set up.`);
      expect(body.replace(card.metricName, "")).not.toMatch(/\d/);
      expect(body).not.toMatch(/as of|n =/);
    }
  });

  it("each card is a section labelled by its h2", async () => {
    const markup = await page();
    const sections = [...markup.matchAll(/<section aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
    expect(sections).toHaveLength(9);
    for (const id of sections) {
      expect(markup).toContain(`<h2 id="${id}"`);
    }
  });

  const row = (band: string, completed: number | null, closed: number | null, rate: number | null, suppressed = false, complementary = false) => ({ band, completed, closed, rate, suppressed, complementary });
  const m4: M4Result = { n: 29, includesHiddenBands: true, rows: [row("a", 12, 14, 0.8571), row("b", null, null, null, true, true), row("c", null, null, null, true)], total: row("total", 25, 29, 0.8621) };
  it("M4 table: scoped headers, right-aligned numbers from md, n<11 cells without a rate, complementary band text, total row and footer note (DS-07c)", () => {
    const markup = renderToStaticMarkup(createElement(MetricCard, { card: METRIC_CARDS[4]!, footer: { ...footer, asOf: "Sep 2026 · includes hidden bands" }, n: 29, rows: 29, body: createElement(M4Table, { data: m4 }) }));
    const headers = [...markup.matchAll(/<th scope="col" class="([^"]+)">([^<]+)<\/th>/g)];
    expect([markup.includes("<caption"), markup.includes('data-slot="table-stack"'), headers.map((h) => h[2])]).toEqual([true, true, [...M4_COLUMNS]]);
    expect(headers.map((h) => h[1].includes("md:text-right"))).toEqual([false, true, true, true]);
    const rows = [...markup.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((m) => plain(m[1]!));
    expect(rows.slice(1)).toEqual(["a Completed: 12 Closed: 14 Rate: 86%", "b Hidden · protects another cell", `c Completed: ${SUPPRESSED} Closed: ${SUPPRESSED} Rate: —`, "All bands Completed: 25 Closed: 29 Rate: 86%"]);
    expect(rows[3]).not.toMatch(/%/);
    expect(plain(markup)).toMatch(/FAS records · Jul–Sep 2026 \(Q3\) · n = 12 · as of Sep 2026 · includes hidden bands/);
  });
  it("M6 card labels both shares in text, lists both group rates, and hides share and bar when a group is under 11 (DS-07c)", () => {
    const groups = [{ group: "affiliated", dollars: 1700, episodes: 17, avgRatePerUnit: 120 }, { group: "other", dollars: 1200, episodes: 12, avgRatePerUnit: 90 }];
    const shown = renderToStaticMarkup(createElement(M6Card, { data: { n: 29, affiliatedShare: 0.5862, groups } as M6Result }));
    expect(plain(shown)).toMatch(/Affiliated providers 59% · Other providers 41%.*Affiliated providers Avg rate per hour: \$120 Dollars: \$1,700 Episodes: 17 Other providers Avg rate per hour: \$90 Dollars: \$1,200 Episodes: 12/);
    expect([...shown.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((h) => h[1])).toEqual([...M6_COLUMNS]);
    expect(shown).toMatch(/aria-hidden="true" class="[^"]*flex h-3.*width:59%.*width:41%/);
    const hidden = renderToStaticMarkup(createElement(M6Card, { data: { n: 20, affiliatedShare: null, groups: [groups[0]!, { group: "other", dollars: null, episodes: null, avgRatePerUnit: null }] } as M6Result }));
    expect(plain(hidden)).toMatch(/Affiliated providers — n<11.*Other providers — n<11.*\$120.*Other providers Avg rate per hour: — n<11/);
    expect(hidden).not.toMatch(/h-3/);
  });
  it("O1 card: one row per active measure with its direction note; mean, share and n hide together under 11 (DS-07c, F-305)", () => {
    const m = { label: "PHQ-9", direction: "lower_is_better" as const, improved: 5, unchanged: 1, worsened: 5 };
    const data = { n: 12, measures: [{ ...m, code: "PHQ-9", n: 11, meanChange: -1.8182, shareImproved: 0.4545, suppressed: false }, { ...m, code: "GAD-7", label: "GAD-7", n: 1, meanChange: null, shareImproved: null, suppressed: true }] } as O1Result;
    const markup = renderToStaticMarkup(createElement(OutcomesCard, { data }));
    expect([...markup.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((h) => h[1])).toEqual([...O1_COLUMNS]);
    expect(plain(markup)).toMatch(/PHQ-9 Lower is better Mean change: −1.8 Share improved: 45% n: 11 GAD-7 Lower is better Mean change: — n<11.*Share improved: — n<11.*n: — n<11/);
    expect(markup).toMatch(/data-measure="GAD-7" data-suppressed="true"/);
  });
  it("wired cards with no rows this quarter say so and keep the source footer; the M1 trend offers View as table (DS-07b)", async () => {
    const markup = await page();
    expect(markup).toMatch(/data-state="no-data".*No closed cases this quarter.*FAS records · \w{3}–\w{3} \d{4} \(Q[1-4]\) · n = 0 · date not available yet/);
    expect(markup).toMatch(/aria-expanded="false" aria-controls="[^"]+"[^>]*>View as table/);
    expect(text(await page({ county: "bogus", referral: "court" }))).toMatch(/No cases match these filters.*Reset filters/);
    expect(markup).not.toMatch(/data-state="not-available"/);
    expect(text(markup)).toMatch(/Completion rate by income band\s*Not enough closed episodes.*Where therapy dollars went\s*Not enough closed episodes.*Outcome change\s*No follow-up scores this quarter/);
  });
  it("MetricCard states: value with text equivalent and delta, suppressed hides value and delta, error keeps the title (DS-07b)", () => {
    const render = (props: Partial<MetricCardProps>) => renderToStaticMarkup(createElement(MetricCard, { card: METRIC_CARDS[0]!, footer, n: 12, rows: 12, ...props }));
    const value = render({ value: "23 days", valueText: "Median 23 days from court order to first session, Q3 2026", delta: "↓ 4 days faster than Q2", stats: "25th pct 14 · n = 12" });
    expect(value).toMatch(/data-state="value".*<span aria-hidden="true">23 days<\/span><span class="sr-only">Median 23 days from court order to first session, Q3 2026<\/span>/);
    expect(text(value)).toMatch(/25th pct 14.*↓ 4 days faster than Q2.*FAS records · Jul–Sep 2026 \(Q3\) · n = 12 · as of Sep 2026/);
    const suppressed = render({ value: null, delta: "↓ 4 days faster than Q2", n: 5, rows: 5 }), error = text(render({ error: "ref-1" }));
    expect(suppressed).toMatch(/data-state="suppressed".*data-slot="suppressed"/);
    expect(text(suppressed)).not.toMatch(/faster|23/);
    expect(error).toMatch(/Days from court order to first session.*Couldn&#x27;t load this number.*Reference ref-1/);
    expect(error).not.toMatch(/as of/);
  });
  it("hides unbuilt actions; describes the filters in the header; renders the freshness and pipeline widgets with empty data", async () => {
    const markup = await page({ county: "bogus", referral: "court", compare: "none" });
    expect(text(markup)).not.toMatch(/Export packet|Open pipeline|Upload data|See all sources/);
    expect(text(markup)).toMatch(/\w{3}\u2013\w{3} \d{4} \(Q[1-4]\) · All counties · court/);
    expect(markup).toMatch(/<form data-slot="filter-form"[^>]*action="\/dashboard" method="get".*Filters · 2/);
    expect(text(markup)).toMatch(/Public data freshness.*No sources registered yet.*Source registry · date not available yet.*Grant pipeline/);
    expect(text(markup)).toMatch(/Grant pipeline.*No opportunities in the pipeline yet.*New.*Reviewing.*Pursuing.*Submitted.*Awarded.*Declined.*Passed.*No upcoming deadline.*date not available yet/);
  });
});
