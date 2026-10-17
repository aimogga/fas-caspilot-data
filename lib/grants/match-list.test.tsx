import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftStrategyButton } from "@/components/grants/DraftStrategyButton";
import { MatchList } from "@/components/grants/MatchList";
import { MatchPanel } from "@/components/grants/MatchPanel";
import { fitBand } from "@/lib/grants/band";
import type { MatchItem } from "@/lib/grants/match-query";

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const item = (i: number, extra: Partial<MatchItem> = {}): MatchItem => ({ id: `r${i}`, title: `Opportunity ${i}`, funder: "Synthetic funder", closes: "no close date", award: "award not stated", status: null, score: 100 - i, eligibility: "Eligible",
  components: [{ key: "mission_fit", label: "Mission fit", weight: 0.3, value: 1, points: 30, max: 30, reason: "Matched 3 of 5 configured themes", source_refs: ["org.program_themes", "opportunity.description"] }], flags: [], awards: null, ...extra });

describe("DS-12b MatchList and MatchPanel", () => {
  it("renders ten cards at a time with a live count and a verb-first button; no count when ten or fewer", () => {
    const twelve = renderToStaticMarkup(<MatchList rows={Array.from({ length: 12 }, (_, i) => item(i))} />);
    expect([(twelve.match(/data-match="/g) ?? []).length, twelve.includes('aria-live="polite"'), text(twelve)]).toEqual([10, true, expect.stringContaining("Showing 10 of 12 Show the last 2")]);
    expect(text(renderToStaticMarkup(<MatchList rows={[item(1), item(2)]} />))).not.toContain("Showing");
  });
  it("the panel shows the award line only from stored rows, ten checks in words and no column path", () => {
    const none = renderToStaticMarkup(<MatchPanel id="p" row={item(1)} onClose={() => undefined} />);
    const some = renderToStaticMarkup(<MatchPanel id="p" row={item(1, { awards: { count: 14, median: 210000 } })} onClose={() => undefined} />);
    expect([none.includes("Past winners"), text(some)]).toEqual([false, expect.stringContaining("Past winners on this listing: 14 awards, the middle one $210,000. Full winning applications are not public.")]);
    expect([(none.match(/data-slot="match-check"/g) ?? []).length, text(none)]).toEqual([10, expect.stringContaining("Who may apply · Passed")]);
    expect(text(none)).toContain("FAS settings · program themes Grant listing · description");
    expect(text(none)).not.toMatch(/org\.|opportunity\./);
  });
  it("F-504d: the band word sits beside the score in the card and the panel, with a glyph and a hint; a capped Pass names its cap", () => {
    const capped = item(2, { score: 0, components: [{ key: "blocker_cap", label: "Blocker", weight: 0, value: 0, points: 0, max: 0, reason: "Score capped at 0: Only states may apply", source_refs: [] }] });
    const list = renderToStaticMarkup(<MatchList rows={[item(1, { score: 80, band: fitBand(80, {}) }), item(3, { score: 64, band: fitBand(64, {}) }), { ...capped, band: fitBand(0, {}, capped.components) }]} />);
    expect([...list.matchAll(/data-band="(\w+)"[^>]*>(.*?)<\/span>/g)].map((m) => [m[1], text(m[2])])).toEqual([["strong", "Strong fit"], ["look", "Worth a look"], ["pass", "Pass: blocker"]]);
    expect((list.match(/data-slot="fit-band"[^>]*><svg/g) ?? []).length).toBe(3);
    const panel = renderToStaticMarkup(<MatchPanel id="p" row={{ ...capped, band: fitBand(0, {}, capped.components) }} onClose={() => undefined} />);
    expect(text(panel)).toMatch(/0 of 100 fit Pass: blocker/);
    expect(renderToStaticMarkup(<MatchList rows={[item(1)]} />)).not.toContain("fit-band");
  });
  it("DS-26a: flag chips stay one line and truncate, the card goes two-column only in a wide list, and the strategy button keeps its full name", () => {
    const long = "Could not check award size: opportunity.award_ceiling missing";
    const list = renderToStaticMarkup(<MatchList rows={[item(1, { eligibility: "Flags: 1", flags: [{ code: "award_size", severity: "info", message: long, source_ref: "opportunity.award_ceiling" }] })]} />);
    const chip = /<span data-slot="flag"[^>]*class="([^"]*)"[^>]*>.*?<span class="truncate">(.*?)<\/span>/.exec(list);
    expect([chip?.[1].includes("whitespace-normal"), chip?.[1].includes("max-w-full"), chip?.[2]]).toEqual([false, true, "Award size not checked: the listing does not state award ceiling"]);
    expect(list).toMatch(/data-slot="match-list" class="@container /);
    expect(list).toMatch(/data-match="r1"[^>]*class="[^"]*lg:@xl:grid-cols-\[auto_1fr\]/);
    const button = renderToStaticMarkup(<DraftStrategyButton opportunityId="o1" />);
    expect([text(/<button[^>]*>.*?<\/button>/.exec(button)?.[0] ?? ""), button.includes("@max-[13rem]/body:sr-only")]).toEqual(["Draft a response strategy", true]);
  });
});
