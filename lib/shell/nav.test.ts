import { describe, expect, it } from "vitest";
import { BOARD_FOOTER, HIDDEN_LABELS, navForRole, roleLabel, syntheticBadgeVisible } from "./nav";

describe("DS-02 nav", () => {
  it("shows only existing routes for each role", () => {
    const labels = (role: string) => navForRole(role).groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels("staff")).toEqual(["Staff home"]);
    expect(labels("admin")).toEqual(["Staff home", "Admin home"]);
    expect(labels("board_viewer")).toEqual(["Board dashboard"]);
    expect(navForRole("board_viewer").footer).toBe(BOARD_FOOTER);
    expect(navForRole("admin").footer).toBeNull();
    for (const role of ["staff", "admin", "board_viewer"]) {
      expect(labels(role).length).toBeLessThanOrEqual(4);
      for (const hidden of HIDDEN_LABELS) expect(labels(role)).not.toContain(hidden);
    }
    expect(roleLabel("board_viewer")).toBe("Board viewer");
    expect(syntheticBadgeVisible("production")).toBe(false);
    expect(syntheticBadgeVisible(undefined)).toBe(true);
  });
});
