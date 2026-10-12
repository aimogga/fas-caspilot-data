import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GENERIC_LOGIN_ERROR, GENERIC_LOGIN_HINT, mapLoginError, RATE_LIMIT_ERROR, RATE_LIMIT_HINT } from "./login-errors";

const ALLOWED = [GENERIC_LOGIN_ERROR, GENERIC_LOGIN_HINT, RATE_LIMIT_ERROR, RATE_LIMIT_HINT];

describe("DS-03 login error mapper", () => {
  it("maps bad credentials and unknown errors to the generic message", () => {
    for (const error of [
      { status: 400, code: "invalid_credentials", message: "Invalid login credentials" },
      { status: 400, code: "email_not_confirmed", message: "Email not confirmed" },
      { status: 500, message: "Database error querying schema" },
      { message: "Failed to fetch" },
      null,
      undefined,
    ]) {
      expect(mapLoginError(error)).toEqual({ title: GENERIC_LOGIN_ERROR, hint: "Check both and try again." });
    }
  });

  it("maps rate limits to the rate-limit message", () => {
    expect(`${RATE_LIMIT_ERROR} ${RATE_LIMIT_HINT}`).toBe("Too many attempts. Wait a few minutes and try again.");
    for (const error of [{ status: 429, message: "x" }, { code: "over_request_rate_limit" }, { message: "Request rate limit reached" }]) {
      expect(mapLoginError(error)).toEqual({ title: RATE_LIMIT_ERROR, hint: RATE_LIMIT_HINT });
    }
  });

  it("never returns raw error text", () => {
    const raw = "RAW-SECRET supabase internal NEXT_PUBLIC_SUPABASE_URL";
    for (const error of [{ message: raw }, { status: 429, message: raw }, { code: raw, message: raw }]) {
      const mapped = mapLoginError(error);
      expect(ALLOWED).toContain(mapped.title);
      expect(ALLOWED).toContain(mapped.hint);
      expect(JSON.stringify(mapped)).not.toContain("RAW-SECRET");
      expect(JSON.stringify(mapped)).not.toMatch(/5 attempts|15 minutes/);
    }
  });

  it("shows no env var names or raw errors on the login page", () => {
    const source = readFileSync("app/login/page.tsx", "utf8");
    expect(source).not.toContain("NEXT_PUBLIC_SUPABASE");
    expect(source).not.toContain("error.message");
  });
});
