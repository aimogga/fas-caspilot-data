import { describe, expect, it } from "vitest";
import { areaName, homeLabel, requestedPath } from "./status";

describe("DS-04 status helpers", () => {
  it("names areas and role homes", () => {
    expect(areaName("/staff")).toBe("staff tools");
    expect(areaName("/admin")).toBe("admin tools");
    expect(areaName("/staff/reports")).toBe("staff tools");
    expect(areaName("/staffing")).toBe("this page");
    expect(areaName("/nope")).toBe("this page");
    expect(areaName(null)).toBe("this page");
    expect(homeLabel("board_viewer")).toBe("Board dashboard");
    expect(homeLabel("staff")).toBe("Staff home");
    expect(homeLabel(null)).toBe("your home");
  });

  it("only echoes safe, same-origin requested paths", () => {
    expect(requestedPath("/staff")).toBe("/staff");
    expect(requestedPath("/admin/users")).toBe("/admin/users");
    for (const bad of ["//evil.com", "https://evil.com", "staff", "/<script>", "/a b", `/${"x".repeat(250)}`, null, 3]) {
      expect(requestedPath(bad)).toBeNull();
    }
  });
});
