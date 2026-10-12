export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; items: NavItem[] };

export const BOARD_FOOTER = "Read-only access · aggregates only";
export const PREVIEW_FOOTER = "Synthetic data · preview";

const STAFF: NavItem = { label: "Home", href: "/staff" };
const ADMIN: NavItem = { label: "Overview", href: "/admin" };
const BOARD: NavItem = { label: "Board dashboard", href: "/board" };

// Screen-plan §1.2 items whose routes do not exist yet; they stay hidden, not dead links.
export const HIDDEN_LABELS = [
  "Team dashboard",
  "County need map",
  "Data freshness",
  "Upload data",
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

export const CRUMB: Record<string, string> = { "/staff": "Home", "/admin": "Admin · Overview", "/board": "Board dashboard" };

export function navForRole(role: string): { groups: NavGroup[]; footer: string | null } {
  if (role === "board_viewer") return { groups: [{ label: "Board", items: [BOARD] }], footer: BOARD_FOOTER };
  if (role === "staff") return { groups: [{ label: "Workspace", items: [STAFF] }], footer: null };
  if (role === "admin") return { groups: [{ label: "Workspace", items: [STAFF] }, { label: "Admin", items: [ADMIN] }], footer: null };
  return { groups: [], footer: null };
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", staff: "Staff", board_viewer: "Board · read-only" };
export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? "Unknown";
}

export function syntheticBadgeVisible(env: string | undefined): boolean {
  return env !== "production";
}
