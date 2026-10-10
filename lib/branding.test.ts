import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ORGANIZATION_NAME, PRODUCT_NAME } from "./branding";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CASE_PILOT = /case\s*pilot/i;

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("product branding", () => {
  it("uses FAS Grants as the product name and Family Advocacy Services as the organization", () => {
    expect(PRODUCT_NAME).toBe("FAS Grants");
    expect(ORGANIZATION_NAME).toBe("Family Advocacy Services");
  });

  it("sets the document title and login heading to FAS Grants", () => {
    expect(read("app/layout.tsx")).toMatch(/title:\s*PRODUCT_NAME/);
    expect(read("app/login/page.tsx")).toMatch(/<h1>\{PRODUCT_NAME\}<\/h1>/);
  });

  it("keeps CasePilot out of rendered UI source", () => {
    const files = [
      "app/layout.tsx",
      "app/page.tsx",
      "app/login/page.tsx",
      "app/403/page.tsx",
      "app/admin/page.tsx",
      "app/staff/page.tsx",
      "app/board/page.tsx",
      "components/PageLayout.tsx",
    ];
    for (const rel of files) {
      expect(read(rel), rel).not.toMatch(CASE_PILOT);
    }
  });

  it("names the product FAS Grants in user-facing product copy", () => {
    expect(read("docs/PRD.md")).toMatch(/one FAS Grants tool/);
    expect(read("docs/PRD.md")).not.toMatch(/one CasePilot tool/);
    expect(read("docs/PROGRESS_CHECKLIST.md")).toMatch(/^# FAS Grants Progress Checklist/m);
  });
});
