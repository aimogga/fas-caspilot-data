import { describe, expect, it } from "vitest";
import { STAGES } from "@/lib/dashboard/query";
import { FLAG_CODES } from "@/lib/grants/eligibility";
import { awardRange, CAP, checklist, COMPONENT, flagWords, GRANT_TERMS, NOT_TRACKED, SEVERITY, sourceWords, stageTerm } from "@/lib/grants/terms";
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
  it("awardRange reads the stored floor and ceiling and never prints a 0 for a missing one; a 0 floor reads as up to", () => {
    expect([awardRange(50000, 200000), awardRange(null, 200000), awardRange(50000, null), awardRange(null, null), awardRange(0, 750000)])
      .toEqual(["$50,000–$200,000", "up to $200,000", "from $50,000", "award not stated", "up to $750,000"]);
  });
});

describe("DS-12b flag, source and checklist words", () => {
  it("flagWords turns a Could-not-check flag into plain words without a column path and passes other stored messages through", () => {
    expect(flagWords("award_size", "Could not check award size: opportunity.award_floor missing")).toBe("Award size not checked: the listing does not state an award range");
    expect(flagWords("applicant_type", "Could not check applicant type: org.is_501c3 missing")).toBe("Applicant type not checked: FAS has not entered whether FAS is a 501(c)(3) in settings");
    expect(flagWords("geography", "Could not check geography: opportunity.raw.summary missing")).toBe("Geography not checked: the listing does not state summary");
    expect(flagWords("applicant_type", "Only state governments may apply")).toBe("Only state governments may apply");
  });
  it("checklist yields the ten checks as pass, flagged or unclear with words; sourceWords names every ref prefix without a path", () => {
    const rows = checklist([{ code: "applicant_type", severity: "blocker", message: "Only state governments may apply", source_ref: "opportunity.eligibility.applicant_types" },
      { code: "award_size", severity: "info", message: "Could not check award size: opportunity.award_floor missing", source_ref: "opportunity.award_floor" }]);
    expect(rows.map((r) => r.code)).toEqual([...FLAG_CODES]);
    expect(rows.map((r) => r.status)).toEqual(["flagged", "pass", "pass", "pass", "pass", "pass", "pass", "unclear", "pass", "pass"]);
    expect([rows[0].label, rows[0].words, rows[1].words, rows[7].words]).toEqual(["Who may apply", "Only state governments may apply", "Passed", "Award size not checked: the listing does not state an award range"]);
    expect([sourceWords("org.program_themes"), sourceWords("eligibility.checks"), sourceWords("match_config.params.prep_days").label]).toEqual([
      { label: "FAS settings · program themes", plain: "From the FAS facts an admin entered in settings: the program themes field." },
      { label: "Eligibility checks", plain: "From the ten eligibility checks." }, "Matching rules · prep days"]);
    expect(JSON.stringify([rows.map((r) => [r.label, r.words]), sourceWords("opportunity.description")])).not.toMatch(/opportunity\.|org\.|match_config\./);
  });
});
