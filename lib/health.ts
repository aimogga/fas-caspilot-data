export type HealthCheck = {
  name: string;
  ok: boolean;
};

export type HealthReport = {
  ok: boolean;
  service: "casepilot-fas";
  checks: HealthCheck[];
};

export function buildHealthReport(checks: readonly HealthCheck[]): HealthReport {
  return {
    ok: checks.every((check) => check.ok),
    service: "casepilot-fas",
    checks: checks.map((check) => ({ name: check.name, ok: check.ok })),
  };
}

export type HealthEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
};

export class SupabaseHealthProbe {
  static readonly LOCAL_BASE_URL = "http://127.0.0.1:54321";
  static readonly HEALTH_PATH = "/auth/v1/health";

  static envFromProcess(): HealthEnv {
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    };
  }

  static probeUrl(env?: HealthEnv): string {
    const source = env ?? SupabaseHealthProbe.envFromProcess();
    const raw = source.NEXT_PUBLIC_SUPABASE_URL;
    if (raw === undefined) {
      return SupabaseHealthProbe.localProbeUrl();
    }
    const trimmed = raw.trim();
    if (trimmed === "") {
      return SupabaseHealthProbe.localProbeUrl();
    }
    const base = trimmed.replace(/\/+$/, "");
    return `${base}${SupabaseHealthProbe.HEALTH_PATH}`;
  }

  static localProbeUrl(): string {
    return `${SupabaseHealthProbe.LOCAL_BASE_URL}${SupabaseHealthProbe.HEALTH_PATH}`;
  }

  static headers(env?: HealthEnv): Record<string, string> {
    const source = env ?? SupabaseHealthProbe.envFromProcess();
    const raw = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (raw === undefined) {
      return {};
    }
    const key = raw.trim();
    if (key === "") {
      return {};
    }
    return { apikey: key };
  }

  static async responds(env?: HealthEnv): Promise<boolean> {
    const source = env ?? SupabaseHealthProbe.envFromProcess();
    try {
      const response = await fetch(SupabaseHealthProbe.probeUrl(source), {
        headers: SupabaseHealthProbe.headers(source),
        signal: AbortSignal.timeout(2000),
      });
      return response.status > 0;
    } catch {
      return false;
    }
  }
}

export function isHealthReport(value: unknown): value is HealthReport {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("ok" in value) || typeof value.ok !== "boolean") {
    return false;
  }
  if (!("service" in value) || value.service !== "casepilot-fas") {
    return false;
  }
  if (!("checks" in value) || !Array.isArray(value.checks)) {
    return false;
  }
  return value.checks.every(
    (check: unknown) =>
      typeof check === "object" &&
      check !== null &&
      "name" in check &&
      typeof check.name === "string" &&
      "ok" in check &&
      typeof check.ok === "boolean",
  );
}
