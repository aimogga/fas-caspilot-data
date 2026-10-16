import { describe, expect, it } from "vitest";
import { NAV_ICONS } from "@/components/shell/nav-icons";
import { navForRole } from "./nav";

describe("DS-18b nav icons", () => {
  it("every href any role can see has its own glyph; no two links share one; nothing extra is mapped", () => {
    const hrefs = [...new Set(["admin", "staff", "board_viewer"].flatMap((r) => navForRole(r).groups.flatMap((g) => g.items.map((i) => i.href))))];
    expect(hrefs).toHaveLength(12);
    for (const h of hrefs) expect(NAV_ICONS[h], h).toBeTypeOf("object");
    expect(new Set(hrefs.map((h) => NAV_ICONS[h])).size).toBe(12);
    expect(Object.keys(NAV_ICONS).sort()).toEqual([...hrefs].sort());
  });
});
