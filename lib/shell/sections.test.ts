import { describe, expect, it } from "vitest";
import { SECTIONS, sectionFor, sectionsForRole } from "./sections";

describe("DS-21 sections", () => {
  it("groups the ten workspace pages into three sections in George's order, keeping every existing URL", () => {
    expect(SECTIONS.map((s) => [s.label, s.tabs.map((t) => `${t.label} ${t.href}`)])).toEqual([
      ["Insights", ["County need map /need-map", "Team dashboard /dashboard"]],
      ["Data", ["Upload /staff/intake", "Enter by hand /staff/entry", "Freshness /data-freshness", "Methodology /methodology"]],
      ["Grants", ["Foundation grants /staff/grants", "Matches /staff/grants/matches"]],
    ]);
  });

  it("finds the section and tab for every tab route, canonicalising the path", () => {
    for (const s of SECTIONS) for (const t of s.tabs) expect(sectionFor(t.href, "staff")).toEqual({ section: s, tab: t });
    expect(sectionFor("/Staff//grants/./matches", "admin")?.tab.label).toBe("Matches");
    for (const path of ["/staff", "/staff/packets", "/board", "/admin", "/403", "/staff/grants/other", "/%00"]) expect(sectionFor(path, "admin"), path).toBeNull();
  });

  it("gives board viewers and unknown roles no tabs", () => {
    for (const role of ["board_viewer", "unknown", ""]) {
      expect(sectionsForRole(role)).toEqual([]);
      expect(sectionFor("/need-map", role)).toBeNull();
      expect(sectionFor("/methodology", role)).toBeNull();
    }
    expect(sectionsForRole("admin")).toBe(SECTIONS);
  });
});
