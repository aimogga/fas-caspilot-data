import { describe, expect, it } from "vitest";
import { STAGES } from "@/lib/dashboard/query";
import { awardRange, CAP, COMPONENT, GRANT_TERMS, NOT_TRACKED, SEVERITY, stageTerm } from "@/lib/grants/terms";
import { SCORERS } from "@/lib/grants/score";

describe("DS-12a grant terms", () => {
  it("every term has a title and at most two plain sentences of 220 characters; no product code anywhere", () => {
    for (const entry of GRANT_TERMS) {
      expect([entry.title.length > 0, entry.plain.length > 0 && entry.plain.length <= 220], entry.id).toEqual([true, true]);
      expect(entry.plain.split(/(?<=[.!?])\s+/).length, `${entry.id}.plain has more than 2 sentences`).toBeLessThanOrEqual(2);
    }
    expect(JSON.stringify(GRANT_TERMS)).not.toMatch(/CasePilot|lorem|N\/A|undefined|\bpct\b|\bM[1-6]\b|!/);
  });
  it("covers every score component key and both caps", () => {
    expect(Object.keys(COMPONENT).sort()).toEqual(Object.keys(SCORERS).sort());
    expect(Object.keys(CAP).sort()).toEqual(["blocker_cap", "floor_cap"]);
    expect(Object.keys(SEVERITY)).toEqual(["blocker", "warning", "info"]);
  });
  it("stageTerm maps the seven stages in any case, reads a missing row as Not tracked yet, and shows an unknown word as stored", () => {
    for (const s of STAGES) expect([stageTerm(s.toUpperCase()).title, stageTerm(` ${s.toLowerCase()} `).title]).toEqual([s, s]);
    expect([stageTerm(null), stageTerm("  ")]).toEqual([NOT_TRACKED, NOT_TRACKED]);
    expect(stageTerm("watch")).toMatchObject({ id: "stage_other", title: "Watch" });
  });
  it("awardRange reads the stored floor and ceiling and never prints a 0 for a missing one", () => {
    expect([awardRange(50000, 200000), awardRange(null, 200000), awardRange(50000, null), awardRange(null, null)])
      .toEqual(["$50,000–$200,000", "up to $200,000", "from $50,000", "award not stated"]);
  });
});
