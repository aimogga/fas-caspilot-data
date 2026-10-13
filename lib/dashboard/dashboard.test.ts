import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import { M4Table } from "@/components/dashboard/M4Table";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { METRIC_CARDS, M4_COLUMNS } from "@/lib/dashboard/cards";

const page = () => renderToStaticMarkup(createElement(DashboardPage));
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ");

describe("DS-07a team dashboard (F-401)", () => {
  it("renders the header and every card in spec order", () => {
    const markup = page();
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

  it("each card is a section labelled by its h2", () => {
    const markup = page();
    const sections = [...markup.matchAll(/<section aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
    expect(sections).toHaveLength(7);
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

  it("hides actions the app does not have yet", () => {
    const body = text(page());
    expect(body).not.toMatch(/Export packet|Open pipeline|Upload data|Filters|View as table/);
  });
});
