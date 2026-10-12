import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildHealthReport, isHealthReport, SupabaseHealthProbe } from "./health";

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

describe("SupabaseHealthProbe.probeUrl", () => {
  it("uses NEXT_PUBLIC_SUPABASE_URL when set", () => {
    const url = SupabaseHealthProbe.probeUrl({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    });
    expect(url).toBe("https://example.supabase.co/auth/v1/health");
  });

  it("falls back to local GoTrue when NEXT_PUBLIC_SUPABASE_URL is unset", () => {
    const url = SupabaseHealthProbe.probeUrl({});
    expect(url).toBe("http://127.0.0.1:54321/auth/v1/health");
  });

  it("strips a trailing slash before appending the health path", () => {
    const url = SupabaseHealthProbe.probeUrl({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
    });
    expect(url).toBe("https://example.supabase.co/auth/v1/health");
  });

  it("sends the publishable key as the apikey header", () => {
    const headers = SupabaseHealthProbe.headers({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "not-a-secret",
    });
    expect(headers).toEqual({ apikey: "not-a-secret" });
  });
});

describe("health route probe wiring", () => {
  it("does not hardcode the local rest URL", () => {
    const source = readFileSync("app/api/health/route.ts", "utf8");
    expect(source).not.toContain("127.0.0.1:54321/rest/v1");
    expect(source).toContain("SupabaseHealthProbe");
  });
});
