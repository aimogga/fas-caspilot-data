import { describe, expect, it } from "vitest";
import { buildHealthReport, isHealthReport } from "./health";

describe("buildHealthReport", () => {
  it("is ok when every check passes", () => {
    const report = buildHealthReport([
      { name: "app", ok: true },
      { name: "supabase", ok: true },
    ]);
    expect(report.ok).toBe(true);
    expect(report.service).toBe("casepilot-fas");
    expect(report.checks).toEqual([
      { name: "app", ok: true },
      { name: "supabase", ok: true },
    ]);
  });

  it("is not ok when any check fails", () => {
    const report = buildHealthReport([
      { name: "app", ok: true },
      { name: "supabase", ok: false },
    ]);
    expect(report.ok).toBe(false);
  });

  it("copies checks so callers cannot mutate the report", () => {
    const checks = [{ name: "app", ok: true }];
    const report = buildHealthReport(checks);
    checks[0].ok = false;
    expect(report.checks[0]?.ok).toBe(true);
  });
});

describe("isHealthReport", () => {
  it("accepts a report from buildHealthReport", () => {
    const report = buildHealthReport([{ name: "app", ok: true }]);
    expect(isHealthReport(report)).toBe(true);
  });

  it("rejects a payload with a different service name", () => {
    expect(
      isHealthReport({
        ok: true,
        service: "other",
        checks: [],
      }),
    ).toBe(false);
  });
});
