import { describe, expect, it } from "vitest";
import { BOARD_FOOTER, CRUMB, crumbFor, HIDDEN_LABELS, navForRole, roleLabel, syntheticBadgeVisible } from "./nav";

describe("DS-02 nav", () => {
  it("shows only existing routes for each role", () => {
    const groups = (role: string) => navForRole(role).groups.map((g) => g.label);
    const labels = (role: string) => navForRole(role).groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels("staff")).toEqual(["Home", "Team dashboard", "Data freshness", "Evidence packets", "Upload data", "Enter data", "Grant matches", "Methodology"]);
    expect(labels("admin")).toEqual(["Home", "Team dashboard", "Data freshness", "Evidence packets", "Upload data", "Enter data", "Grant matches", "Methodology", "Overview"]);
    expect(labels("board_viewer")).toEqual(["Board dashboard", "Methodology"]);
    expect(groups("staff")).toEqual(["Workspace"]);
    expect(groups("admin")).toEqual(["Workspace", "Admin"]);
    expect(navForRole("board_viewer").footer).toBe(BOARD_FOOTER);
    expect(navForRole("admin").footer).toBeNull();
    for (const role of ["staff", "admin", "board_viewer"]) {
      // Workspace grows as screen-plan §1.2 routes land; the cap guards against a dump of every item into one group.
      for (const g of navForRole(role).groups) expect(g.items.length).toBeLessThanOrEqual(8);
      for (const hidden of HIDDEN_LABELS) {
        expect(labels(role)).not.toContain(hidden);
      }
    }
    expect(CRUMB["/board"]).toBe("Board dashboard");
    expect(CRUMB["/methodology"]).toBe("Methodology");
    expect(CRUMB["/dashboard"]).toBe("Team dashboard");
    expect(CRUMB["/data-freshness"]).toBe("Data freshness");
    expect(HIDDEN_LABELS).not.toContain("Data freshness");
    expect(CRUMB["/staff/packets"]).toBe("Evidence packets");
    expect(CRUMB["/staff/intake"]).toBe("Upload data");
    expect(HIDDEN_LABELS).not.toContain("Upload data");
    expect(CRUMB["/staff/entry"]).toBe("Enter data");
    expect(HIDDEN_LABELS).not.toContain("Enter data");
    expect(HIDDEN_LABELS).not.toContain("Team dashboard");
    expect(HIDDEN_LABELS).not.toContain("Methodology");
    expect(roleLabel("board_viewer")).toBe("Board · read-only");
    expect(syntheticBadgeVisible("production")).toBe(false);
    expect(syntheticBadgeVisible(undefined)).toBe(true);
  });
});

describe("shell breadcrumb", () => {
  it("shows Account not set up for a user with no role, whatever the URL", () => {
    for (const role of ["unknown", "", "other", "constructor", "toString"]) {
      for (const path of ["/board", "/staff", "/admin", "/403", "/nope"]) {
        expect(crumbFor(role, path, "FAS Evidence")).toBe("Account not set up");
      }
    }
  });

  it("keeps the existing crumbs for roles that have a home", () => {
    expect(crumbFor("admin", "/admin", "FAS Evidence")).toBe("Admin · Overview");
    expect(crumbFor("staff", "/staff", "FAS Evidence")).toBe("Home");
    expect(crumbFor("staff", "/staff/grants/matches", "FAS Evidence")).toBe("Grant matches");
    expect(crumbFor("board_viewer", "/board", "FAS Evidence")).toBe("Board dashboard");
    expect(crumbFor("admin", "/%61dmin", "FAS Evidence")).toBe("Admin · Overview");
    expect(crumbFor("board_viewer", "/403", "FAS Evidence")).toBe("FAS Evidence");
    expect(crumbFor("board_viewer", "/methodology", "FAS Evidence")).toBe("Methodology");
    expect(crumbFor("staff", "/dashboard", "FAS Evidence")).toBe("Team dashboard");
    expect(crumbFor("admin", "/data-freshness", "FAS Evidence")).toBe("Data freshness");
    expect(crumbFor("staff", "/staff/packets", "FAS Evidence")).toBe("Evidence packets");
    expect(crumbFor("staff", "/staff/intake", "FAS Evidence")).toBe("Upload data");
    expect(crumbFor("staff", "/staff/entry", "FAS Evidence")).toBe("Enter data");
  });
});
