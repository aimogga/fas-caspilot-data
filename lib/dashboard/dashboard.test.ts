import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import { M4Table } from "@/components/dashboard/M4Table";
import { MetricCard, type MetricCardProps } from "@/components/dashboard/MetricCard";
import { METRIC_CARDS, M4_COLUMNS } from "@/lib/dashboard/cards";

const empty = { data: [], error: null };
type Chain = Promise<typeof empty> & Record<"order" | "limit" | "eq" | "gte" | "lte", () => Chain>;
/** Every table and view read resolves to no rows; `.order/.limit` (widgets) and `.gte/.lte/.eq` (F-304 views) chain. */
const chain = (): Chain => Object.assign(Promise.resolve(empty), { order: chain, limit: chain, eq: chain, gte: chain, lte: chain });
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ select: chain }) }) }));
const footer = { source: "FAS records", period: "Jul–Sep 2026 (Q3)", n: "= 12", asOf: "Sep 2026" };
const page = async (params = {}) => renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve(params) }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ");

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

  it("M4 table has a caption, scoped headers and right-aligned numbers", () => {
    const markup = renderToStaticMarkup(createElement(M4Table));
    expect(markup).toContain("<caption");
    const headers = [...markup.matchAll(/<th scope="col" class="([^"]+)">([^<]+)<\/th>/g)];
    expect(headers.map((match) => match[2])).toEqual([...M4_COLUMNS]);
    expect(headers.map((match) => match[1].includes("text-right"))).toEqual([false, true, true, true]);
    expect(markup).toContain(`colSpan="${M4_COLUMNS.length}"`);
    expect(text(markup).replace("M4", "")).not.toMatch(/\d/);
  });

  it("M4 table fits 375px without horizontal scroll", () => {
    const markup = renderToStaticMarkup(createElement(M4Table));
    expect(markup).toMatch(/<table class="[^"]*\bw-full\b[^"]*\btable-fixed\b/);
    expect(markup).toMatch(/<th[^>]*break-words/);
  });
  it("wired cards with no rows this quarter say so and keep the source footer; the M1 trend offers View as table (DS-07b)", async () => {
    const markup = await page();
    expect(markup).toMatch(/data-state="no-data".*No closed cases this quarter.*FAS records · \w{3}–\w{3} \d{4} \(Q[1-4]\) · n = 0 · as of Not available yet/);
    expect(markup).toMatch(/aria-expanded="false" aria-controls="[^"]+"[^>]*>View as table/);
    expect(text(await page({ county: "bogus", referral: "court" }))).toMatch(/No cases match these filters.*Reset filters/);
    expect(markup.match(/data-state="not-available"/g)).toHaveLength(3);
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
    expect(text(markup)).toMatch(/Public data freshness.*No sources registered yet.*Source registry · as of Not available yet.*Grant pipeline/);
    expect(text(markup)).toMatch(/Grant pipeline.*No opportunities in the pipeline yet.*New.*Reviewing.*Pursuing.*Submitted.*Awarded.*Declined.*Passed.*No upcoming deadline.*as of Not available yet/);
  });
});
