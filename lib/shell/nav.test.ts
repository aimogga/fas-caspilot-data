import { describe, expect, it } from "vitest";
import { BOARD_FOOTER, CRUMB, crumbFor, HIDDEN_LABELS, navActive, navForRole, roleLabel, syntheticBadgeVisible } from "./nav";

describe("DS-02 nav", () => {
  it("shows only existing routes for each role", () => {
    const groups = (role: string) => navForRole(role).groups.map((g) => g.label);
    const labels = (role: string) => navForRole(role).groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels("staff")).toEqual(["Home", "Insights", "Data", "Grants", "Evidence packets", "Board dashboard"]);
    expect(labels("admin")).toEqual(["Home", "Insights", "Data", "Grants", "Evidence packets", "Board dashboard", "Overview"]);
    expect(labels("board_viewer")).toEqual(["Board dashboard", "County need map", "Methodology"]);
    expect(groups("staff")).toEqual(["Workspace", "Board"]);
    expect(groups("admin")).toEqual(["Workspace", "Board", "Admin"]);
    expect(navForRole("board_viewer").footer).toBe(BOARD_FOOTER);
    expect(navForRole("admin").footer).toBeNull();
    for (const role of ["staff", "admin", "board_viewer"]) {
      // DS-21: Workspace holds five task links; new pages join a section as a tab, not the sidebar.
      for (const g of navForRole(role).groups) expect(g.items.length).toBeLessThanOrEqual(5);
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
    expect(CRUMB["/need-map"]).toBe("County need map");
    expect(HIDDEN_LABELS).not.toContain("County need map");
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
    expect(crumbFor("staff", "/staff/grants", "FAS Evidence")).toBe("Grants · Foundation grants");
    expect(crumbFor("staff", "/staff/grants/matches", "FAS Evidence")).toBe("Grants · Matches");
    expect(crumbFor("board_viewer", "/board", "FAS Evidence")).toBe("Board dashboard");
    expect(crumbFor("admin", "/%61dmin", "FAS Evidence")).toBe("Admin · Overview");
    expect(crumbFor("board_viewer", "/403", "FAS Evidence")).toBe("FAS Evidence");
    expect(crumbFor("board_viewer", "/methodology", "FAS Evidence")).toBe("Methodology");
    expect(crumbFor("board_viewer", "/need-map", "FAS Evidence")).toBe("County need map");
    expect(crumbFor("staff", "/dashboard", "FAS Evidence")).toBe("Insights · Team dashboard");
    expect(crumbFor("admin", "/need-map", "FAS Evidence")).toBe("Insights · County need map");
    expect(crumbFor("admin", "/data-freshness", "FAS Evidence")).toBe("Data · Freshness");
    expect(crumbFor("staff", "/methodology", "FAS Evidence")).toBe("Data · Methodology");
    expect(crumbFor("staff", "/staff/packets", "FAS Evidence")).toBe("Evidence packets");
    expect(crumbFor("staff", "/staff/intake", "FAS Evidence")).toBe("Data · Upload");
    expect(crumbFor("staff", "/staff/entry", "FAS Evidence")).toBe("Data · Enter by hand");
  });
});

describe("DS-21 section links", () => {
  const item = (role: string, label: string) => navForRole(role).groups.flatMap((g) => g.items).find((i) => i.label === label)!;
  const active = (role: string, path: string) => navForRole(role).groups.flatMap((g) => g.items).filter((i) => navActive(role, i, path)).map((i) => i.label);

  it("each section link opens its first tab", () => {
    expect(["Insights", "Data", "Grants"].map((l) => item("staff", l).href)).toEqual(["/dashboard", "/staff/intake", "/staff/grants"]);
  });

  it("exactly one sidebar link is active on every page, and a section link is active on all of its tabs", () => {
    const cases = [["/staff", "Home"], ["/dashboard", "Insights"], ["/need-map", "Insights"], ["/staff/intake", "Data"], ["/staff/entry", "Data"], ["/data-freshness", "Data"], ["/methodology", "Data"], ["/staff/grants", "Grants"], ["/staff/grants/matches", "Grants"], ["/staff/packets", "Evidence packets"], ["/board", "Board dashboard"]] as const;
    for (const [path, label] of cases) for (const role of ["staff", "admin"]) expect(active(role, path), `${role} ${path}`).toEqual([label]);
    expect(active("admin", "/admin")).toEqual(["Overview"]);
    expect(active("staff", "/%73taff/intake")).toEqual(["Data"]);
  });

  it("board viewers keep their direct links and the same active rule as before", () => {
    expect(active("board_viewer", "/need-map")).toEqual(["County need map"]);
    expect(active("board_viewer", "/methodology")).toEqual(["Methodology"]);
    expect(active("board_viewer", "/board")).toEqual(["Board dashboard"]);
  });
});
