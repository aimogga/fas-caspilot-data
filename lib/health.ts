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
