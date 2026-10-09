export type UserRole = 'admin' | 'staff' | 'board_viewer';
const ALL: UserRole[] = ['admin', 'staff', 'board_viewer'];
const RULES: Record<string, UserRole[]> = {
  '/login': ALL, '/': ALL, '/staff': ['admin', 'staff'], '/admin': ['admin'], '/board': ALL,
};
export function isRouteAllowed(path: string, role: UserRole | null): boolean {
  return !!role && (RULES[path]?.includes(role) ?? false);
}
export function getAllowedRoles(path: string): UserRole[] {
  return RULES[path] ?? [];
}
export function isPublicRoute(path: string): boolean {
  return path === '/login' || path === '/403' || path === '/api/auth/signout';
}

const UNSAFE = /[\\\x00-\x1F\x7F]/;
export function safeRedirect(redirect: unknown, origin: string): string {
  if (typeof redirect !== 'string' || !redirect) return '/';
  let decoded = redirect;
  try { decoded = decodeURIComponent(redirect); } catch { return '/'; }
  if (UNSAFE.test(redirect) || UNSAFE.test(decoded)) return '/';
  try {
    const url = new URL(redirect, origin);
    if (url.origin !== origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
