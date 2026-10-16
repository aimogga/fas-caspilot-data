import { canonicalizePath } from "@/lib/auth/role-guards";
import { SECTIONS, sectionFor } from "./sections";

/** `section` marks a DS-21 section link: it opens the first tab and stays active on every tab. */
export type NavItem = { label: string; href: string; section?: string };
export type NavGroup = { label: string; items: NavItem[] };

export const BOARD_FOOTER = "Read-only access · aggregates only";
export const PREVIEW_FOOTER = "Synthetic data · preview";

const STAFF: NavItem = { label: "Home", href: "/staff" };
const ADMIN: NavItem = { label: "Overview", href: "/admin" };
const BOARD: NavItem = { label: "Board dashboard", href: "/board" };
const METHOD: NavItem = { label: "Methodology", href: "/methodology" };
const PACKETS: NavItem = { label: "Evidence packets", href: "/staff/packets" };
const MAP: NavItem = { label: "County need map", href: "/need-map" };
const KNOW: NavItem = { label: "FAS knowledge", href: "/admin/knowledge" };
const [INSIGHTS, DATA, GRANTS] = SECTIONS.map((s): NavItem => ({ label: s.label, href: s.tabs[0].href, section: s.label }));

// Screen-plan §1.2 items whose routes do not exist yet; they stay hidden, not dead links.
export const HIDDEN_LABELS = [
  "Cases",
  "Aggregate totals",
  "Providers",
  "Matches",
  "Pipeline",
  "Strategy drafts",
  "Packets",
  "Users & roles",
  "Org settings",
  "Data sources & ingest runs",
  "Need-score weights",
  "Audit log",
  "Nightly audits",
  "Board packets",
] as const;

export const CRUMB: Record<string, string> = {
  "/staff": "Home", "/admin": "Admin · Overview", "/board": "Board dashboard", "/methodology": "Methodology", "/dashboard": "Team dashboard",
  "/data-freshness": "Data freshness", "/staff/packets": "Evidence packets", "/staff/intake": "Upload data", "/staff/entry": "Enter data",
  "/staff/grants": "Foundation grants", "/staff/grants/matches": "Grant matches", "/need-map": "County need map",
  "/admin/knowledge": "Admin · FAS knowledge",
};

export const NO_ROLE_CRUMB = "Account not set up";

/** Staff and admin read "Data · Upload" on a tab page; a board viewer keeps the plain page name. */
export function crumbFor(role: string, pathname: string, fallback: string): string {
  if (!Object.hasOwn(ROLE_LABEL, role)) return NO_ROLE_CRUMB;
  const here = sectionFor(pathname, role);
  if (here) return `${here.section.label} · ${here.tab.label}`;
  return CRUMB[canonicalizePath(pathname) ?? pathname] ?? fallback;
}

export function navForRole(role: string): { groups: NavGroup[]; footer: string | null } {
  if (role === "board_viewer") return { groups: [{ label: "Board", items: [BOARD, MAP, METHOD] }], footer: BOARD_FOOTER };
  // George (2026-10-15): staff and admin reach the board dashboard from the nav, in its own group so Workspace keeps its cap.
  const WORKSPACE: NavGroup = { label: "Workspace", items: [STAFF, INSIGHTS, DATA, GRANTS, PACKETS] };
  if (role === "staff") return { groups: [WORKSPACE, { label: "Board", items: [BOARD] }], footer: null };
  if (role === "admin") return { groups: [WORKSPACE, { label: "Board", items: [BOARD] }, { label: "Admin", items: [ADMIN, KNOW] }], footer: null };
  return { groups: [], footer: null };
}

export function navActive(role: string, item: NavItem, pathname: string): boolean {
  if (item.section) return sectionFor(pathname, role)?.section.label === item.section;
  return (canonicalizePath(pathname) ?? pathname) === item.href;
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", staff: "Staff", board_viewer: "Board · read-only" };
export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? "Unknown";
}

export function syntheticBadgeVisible(env: string | undefined): boolean {
  return env !== "production";
}
