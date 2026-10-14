import { canonicalizePath } from "@/lib/auth/role-guards";

export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; items: NavItem[] };

export const BOARD_FOOTER = "Read-only access · aggregates only";
export const PREVIEW_FOOTER = "Synthetic data · preview";

const STAFF: NavItem = { label: "Home", href: "/staff" };
const ADMIN: NavItem = { label: "Overview", href: "/admin" };
const BOARD: NavItem = { label: "Board dashboard", href: "/board" };
const UPLOAD: NavItem = { label: "Upload data", href: "/staff/intake" };

// Screen-plan §1.2 items whose routes do not exist yet; they stay hidden, not dead links.
export const HIDDEN_LABELS = [
  "Team dashboard",
  "County need map",
  "Data freshness",
  "Cases",
  "Aggregate totals",
  "Providers",
  "Matches",
  "Pipeline",
  "Strategy drafts",
  "Packets",
  "Methodology",
  "Users & roles",
  "Org settings",
  "Data sources & ingest runs",
  "Need-score weights",
  "Audit log",
  "Nightly audits",
  "Board packets",
] as const;

export const CRUMB: Record<string, string> = { "/staff": "Home", "/admin": "Admin · Overview", "/board": "Board dashboard", "/staff/intake": "Upload data" };

export const NO_ROLE_CRUMB = "Account not set up";

export function crumbFor(role: string, pathname: string, fallback: string): string {
  if (!Object.hasOwn(ROLE_LABEL, role)) return NO_ROLE_CRUMB;
  return CRUMB[canonicalizePath(pathname) ?? pathname] ?? fallback;
}

export function navForRole(role: string): { groups: NavGroup[]; footer: string | null } {
  if (role === "board_viewer") return { groups: [{ label: "Board", items: [BOARD] }], footer: BOARD_FOOTER };
  if (role === "staff") return { groups: [{ label: "Workspace", items: [STAFF, UPLOAD] }], footer: null };
  if (role === "admin") return { groups: [{ label: "Workspace", items: [STAFF, UPLOAD] }, { label: "Admin", items: [ADMIN] }], footer: null };
  return { groups: [], footer: null };
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", staff: "Staff", board_viewer: "Board · read-only" };
export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? "Unknown";
}

export function syntheticBadgeVisible(env: string | undefined): boolean {
  return env !== "production";
}
