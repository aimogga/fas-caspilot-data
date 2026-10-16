import { BookOpen, ChartColumn, ClipboardPen, Clock, FileText, House, Landmark, LayoutDashboard, Map, Shield, Target, Upload, type LucideIcon } from "lucide-react";

/** DS-18b: one lucide glyph per nav href, so the 56 px rail (768–1023) shows twelve different marks instead of a house for every link. Rendered 16 px, `aria-hidden`, default stroke. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  "/staff": House, "/dashboard": ChartColumn, "/need-map": Map, "/data-freshness": Clock, "/staff/packets": FileText, "/staff/intake": Upload,
  "/staff/entry": ClipboardPen, "/staff/grants": Landmark, "/staff/grants/matches": Target, "/methodology": BookOpen, "/board": LayoutDashboard, "/admin": Shield,
};
