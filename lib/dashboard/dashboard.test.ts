import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import { M4Table } from "@/components/dashboard/M4Table";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { METRIC_CARDS, M4_COLUMNS } from "@/lib/dashboard/cards";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ select: async () => ({ data: [], error: null }) }) }) }));
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
    expect(sections).toHaveLength(8);
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

  it("hides unbuilt actions; describes the filters in the header; renders the pipeline widget with empty data", async () => {
    const markup = await page({ county: "bogus", referral: "court", compare: "none" });
    expect(text(markup)).not.toMatch(/Export packet|Open pipeline|Upload data|See all sources|View as table/);
    expect(text(markup)).toMatch(/\w{3}\u2013\w{3} \d{4} \(Q[1-4]\) · All counties · court/);
    expect(markup).toMatch(/<form data-slot="filter-form"[^>]*action="\/dashboard" method="get".*Filters · 2/);
    expect(text(markup)).toMatch(/Grant pipeline.*No opportunities in the pipeline yet.*New.*Reviewing.*Pursuing.*Submitted.*Awarded.*Declined.*Passed.*No upcoming deadline.*as of Not available yet/);
  });
});
