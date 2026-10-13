import type { UserRole } from "@/lib/auth/role-guards";

const AREA: Record<string, string> = { "/staff": "staff tools", "/admin": "admin tools", "/board": "the board dashboard" };
const HOME_LABEL: Record<UserRole, string> = { admin: "Admin overview", staff: "Staff home", board_viewer: "Board dashboard" };

export function areaName(path: string | null): string {
  if (!path) return "this page";
  const root = "/" + path.toLowerCase().split(/[/?#]/)[1];
  return AREA[root] ?? "this page";
}

export function homeLabel(role: UserRole | null): string {
  return role ? HOME_LABEL[role] ?? "your home" : "your home";
}

export function requestedPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.length > 200) return null;
  return /^[\w\-./~%]+$/.test(raw) ? raw : null;
}
