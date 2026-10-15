import { canonicalizePath } from "@/lib/auth/role-guards";

export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; items: NavItem[] };

export const BOARD_FOOTER = "Read-only access · aggregates only";
export const PREVIEW_FOOTER = "Synthetic data · preview";

const STAFF: NavItem = { label: "Home", href: "/staff" };
const GRANTS: NavItem = { label: "Foundation grants", href: "/staff/grants" };
const MATCHES: NavItem = { label: "Grant matches", href: "/staff/grants/matches" };
const ADMIN: NavItem = { label: "Overview", href: "/admin" };
const BOARD: NavItem = { label: "Board dashboard", href: "/board" };
const UPLOAD: NavItem = { label: "Upload data", href: "/staff/intake" };
const ENTRY: NavItem = { label: "Enter data", href: "/staff/entry" };
const METHOD: NavItem = { label: "Methodology", href: "/methodology" };
const DASH: NavItem = { label: "Team dashboard", href: "/dashboard" };
const PACKETS: NavItem = { label: "Evidence packets", href: "/staff/packets" };
const FRESH: NavItem = { label: "Data freshness", href: "/data-freshness" };
const MAP: NavItem = { label: "County need map", href: "/need-map" };

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
};

export const NO_ROLE_CRUMB = "Account not set up";

export function crumbFor(role: string, pathname: string, fallback: string): string {
  if (!Object.hasOwn(ROLE_LABEL, role)) return NO_ROLE_CRUMB;
  return CRUMB[canonicalizePath(pathname) ?? pathname] ?? fallback;
}

export function navForRole(role: string): { groups: NavGroup[]; footer: string | null } {
  if (role === "board_viewer") return { groups: [{ label: "Board", items: [BOARD, MAP, METHOD] }], footer: BOARD_FOOTER };
  if (role === "staff") return { groups: [{ label: "Workspace", items: [STAFF, DASH, MAP, FRESH, PACKETS, UPLOAD, ENTRY, GRANTS, MATCHES, METHOD] }], footer: null };
  if (role === "admin") return { groups: [{ label: "Workspace", items: [STAFF, DASH, MAP, FRESH, PACKETS, UPLOAD, ENTRY, GRANTS, MATCHES, METHOD] }, { label: "Admin", items: [ADMIN] }], footer: null };
  return { groups: [], footer: null };
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", staff: "Staff", board_viewer: "Board · read-only" };
export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? "Unknown";
}

export function syntheticBadgeVisible(env: string | undefined): boolean {
  return env !== "production";
}
