export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; items: NavItem[] };

export const BOARD_FOOTER = "Read-only access · aggregates only";

const STAFF: NavItem = { label: "Staff home", href: "/staff" };
const ADMIN: NavItem = { label: "Admin home", href: "/admin" };
const BOARD: NavItem = { label: "Board dashboard", href: "/board" };

export const HIDDEN_LABELS = ["Packets", "Sources", "Ingest runs", "Users", "Audit log"] as const;

export const PAGE_TITLE: Record<string, string> = { "/staff": "Staff Page", "/admin": "Admin Page", "/board": "Board Page" };

export function navForRole(role: string): { groups: NavGroup[]; footer: string | null } {
  if (role === "board_viewer") return { groups: [{ label: "Board", items: [BOARD] }], footer: BOARD_FOOTER };
  if (role === "staff") return { groups: [{ label: "Staff", items: [STAFF] }], footer: null };
  if (role === "admin") return { groups: [{ label: "Staff", items: [STAFF] }, { label: "Admin", items: [ADMIN] }], footer: null };
  return { groups: [], footer: null };
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", staff: "Staff", board_viewer: "Board viewer" };
export function roleLabel(role: string): string { return ROLE_LABEL[role] ?? "Unknown"; }

export function syntheticBadgeVisible(env: string | undefined): boolean {
  return env !== "production";
}
