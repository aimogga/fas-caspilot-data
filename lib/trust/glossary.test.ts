import { describe, expect, it } from "vitest";
import { METRIC_CARDS } from "@/lib/dashboard/cards";
import { GLOSSARY, HIDDEN_SMALL, sourceTerm, term, whyHidden, type HiddenKind } from "@/lib/trust/glossary";

const KINDS: HiddenKind[] = ["suppressed", "complementary", "not_published", "not_available", "error"];
const SOURCES = ["FAS records", "Census SAHIE", "Census SAIPE", "Census ACS 5-year", "Grants.gov"];

describe("DS-09 glossary", () => {
  it("every entry has a title and at most two plain sentences of 220 characters; no product code anywhere", () => {
    for (const [id, entry] of Object.entries(GLOSSARY)) {
      expect([entry.id, entry.title.length > 0, entry.plain.length > 0 && entry.plain.length <= 220], id).toEqual([id, true, true]);
      expect(entry.plain.split(/(?<=[.!?])\s+/).length, `${id}.plain has more than 2 sentences`).toBeLessThanOrEqual(2);
    }
    expect(JSON.stringify(GLOSSARY) + KINDS.map(whyHidden).join(" ") + SOURCES.map((s) => sourceTerm(s).plain).join(" ")).not.toMatch(/CasePilot|lorem|N\/A|undefined/);
  });
  it("every metric card has a term with the card's title and the FAS source; term() accepts an id or a term and never throws", () => {
    for (const card of METRIC_CARDS) expect(term(card.id)).toMatchObject({ title: card.title, source: "FAS records", hidden: HIDDEN_SMALL });
    expect([term("median"), term(GLOSSARY.rank)]).toEqual([GLOSSARY.median, GLOSSARY.rank]);
    expect(term("nope")).toMatchObject({ id: "nope", title: "nope" });
  });
  it("sourceTerm names the five known sources and falls back for the rest", () => {
    for (const name of SOURCES) expect([sourceTerm(name).title, sourceTerm(name).plain === sourceTerm("Other").plain]).toEqual([name, false]);
    expect(sourceTerm("Utah Courts")).toMatchObject({ title: "Utah Courts", plain: expect.stringContaining("public data source") });
  });
  it("whyHidden gives one plain sentence for every kind", () => {
    for (const kind of KINDS) expect(whyHidden(kind), kind).toMatch(/^[^.]+\.$/);
    expect(whyHidden("suppressed")).toBe(HIDDEN_SMALL);
  });
});
