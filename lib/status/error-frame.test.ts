import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveErrorViewer, shellDisplayName, SIGNED_OUT_VIEWER } from "./error-frame";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

afterEach(() => {
  vi.useRealTimers();
});

describe("error frame viewer", () => {
  it("keeps a signed-in viewer and uses email the way AppShell does", async () => {
    const viewer = { signedIn: true, role: "admin" as const, email: "admin@example.test" };
    await expect(resolveErrorViewer(() => Promise.resolve(viewer))).resolves.toEqual(viewer);
    expect(shellDisplayName("admin@example.test")).toBe("admin@example.test");
    expect(shellDisplayName(null)).toBe("Signed in");
    expect(readFileSync(join(root, "components/shell/AppShell.tsx"), "utf8")).toMatch(/name=\{user\.email \?\? "Signed in"\}/);
    expect(readFileSync(join(root, "components/status/ErrorFrame.tsx"), "utf8")).toMatch(/name=\{shellDisplayName\(viewer\.email\)\}/);
    expect(readFileSync(join(root, "components/status/ErrorFrame.tsx"), "utf8")).not.toMatch(/name="Signed in"/);
  });

  it("falls back to the signed-out viewer when the loader rejects", async () => {
    await expect(resolveErrorViewer(() => Promise.reject(new Error("network")))).resolves.toEqual(SIGNED_OUT_VIEWER);
  });

  it("falls back to the signed-out viewer when the loader times out", async () => {
    vi.useFakeTimers();
    const pending = resolveErrorViewer(() => new Promise(() => {}), 50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toEqual(SIGNED_OUT_VIEWER);
  });
});
