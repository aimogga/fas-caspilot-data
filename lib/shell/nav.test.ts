import { describe, expect, it } from "vitest";
import { BOARD_FOOTER, CRUMB, crumbFor, HIDDEN_LABELS, navForRole, roleLabel, syntheticBadgeVisible } from "./nav";

describe("DS-02 nav", () => {
  it("shows only existing routes for each role", () => {
    const groups = (role: string) => navForRole(role).groups.map((g) => g.label);
    const labels = (role: string) => navForRole(role).groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels("staff")).toEqual(["Home", "Grant matches"]);
    expect(labels("admin")).toEqual(["Home", "Grant matches", "Overview"]);
    expect(labels("board_viewer")).toEqual(["Board dashboard"]);
    expect(groups("staff")).toEqual(["Workspace"]);
    expect(groups("admin")).toEqual(["Workspace", "Admin"]);
    expect(navForRole("board_viewer").footer).toBe(BOARD_FOOTER);
    expect(navForRole("admin").footer).toBeNull();
    for (const role of ["staff", "admin", "board_viewer"]) {
      expect(labels(role).length).toBeLessThanOrEqual(4);
      for (const hidden of HIDDEN_LABELS) {
        expect(labels(role)).not.toContain(hidden);
      }
    }
    expect(CRUMB["/board"]).toBe("Board dashboard");
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
  });
});
