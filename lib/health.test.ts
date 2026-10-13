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

describe("SupabaseHealthProbe.responds", () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" };

  it("returns false when fetch rejects", async () => {
    const rejected: typeof fetch = async () => {
      throw new Error("network down");
    };
    const ok = await SupabaseHealthProbe.responds(env, rejected);
    expect(ok).toBe(false);
  });

  it("returns false when fetch times out", async () => {
    const hanging: typeof fetch = async (_input, init) => {
      return await new Promise<Response>((resolve, reject) => {
        const signal = init?.signal;
        if (signal === undefined || signal === null) {
          resolve(new Response("{}", { status: 200 }));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(signal.reason ?? new Error("aborted"));
        });
      });
    };
    const ok = await SupabaseHealthProbe.responds(env, hanging, 20);
    expect(ok).toBe(false);
  });

  it("returns false when fetch returns 503", async () => {
    const fail: typeof fetch = async () => {
      return new Response("down", { status: 503 });
    };
    const ok = await SupabaseHealthProbe.responds(env, fail);
    expect(ok).toBe(false);
  });

  it("returns true when fetch returns 200", async () => {
    const okFetch: typeof fetch = async () => {
      return new Response("{}", { status: 200 });
    };
    const ok = await SupabaseHealthProbe.responds(env, okFetch);
    expect(ok).toBe(true);
  });
});
