import { describe, expect, it } from "vitest";
import { BOARD_FOOTER, HIDDEN_LABELS, navForRole, roleLabel, syntheticBadgeVisible } from "./nav";

describe("DS-02 nav", () => {
  it("shows only existing routes for each role", () => {
    const groups = (role: string) => navForRole(role).groups.map((g) => g.label);
    const labels = (role: string) => navForRole(role).groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels("staff")).toEqual(["Home"]);
    expect(labels("admin")).toEqual(["Home", "Overview"]);
    expect(labels("board_viewer")).toEqual(["Board dashboard"]);
    expect(groups("staff")).toEqual(["Workspace"]);
    expect(groups("admin")).toEqual(["Workspace", "Admin"]);
    expect(navForRole("board_viewer").footer).toBe(BOARD_FOOTER);
    expect(navForRole("admin").footer).toBeNull();
    for (const role of ["staff", "admin", "board_viewer"]) {
      expect(labels(role).length).toBeLessThanOrEqual(4);
      for (const hidden of HIDDEN_LABELS) expect(labels(role)).not.toContain(hidden);
    }
    expect(roleLabel("board_viewer")).toBe("Board · read-only");
    expect(syntheticBadgeVisible("production")).toBe(false);
    expect(syntheticBadgeVisible(undefined)).toBe(true);
  });
});
