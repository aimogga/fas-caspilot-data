import { BookOpen, Database, FileText, House, Landmark, LayoutDashboard, Map, Shield, type LucideIcon } from "lucide-react";

/** DS-18b, DS-21: one lucide glyph per nav href, so the 56 px rail (768–1023) shows a different mark for every link. Rendered 16 px, `aria-hidden`, default stroke. Section links are keyed by their first tab. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  "/staff": House, "/staff/intake": Database, "/staff/grants": Landmark, "/staff/packets": FileText,
  "/board": LayoutDashboard, "/admin": Shield, "/need-map": Map, "/methodology": BookOpen,
};
