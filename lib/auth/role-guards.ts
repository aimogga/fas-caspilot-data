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
const HOME: Record<UserRole, string> = { admin: '/admin', staff: '/staff', board_viewer: '/board' };
export function roleHome(role: UserRole | null): string | null {
  return role ? HOME[role] ?? null : null;
}
export function isPublicRoute(path: string): boolean {
  return path === '/login' || path === '/403' || path === '/api/auth/signout' || path === '/api/health' || path === '/ui' || path === '/health' || path === '/dev-error';
}
export function hadSession(cookieNames: string[]): boolean {
  return cookieNames.some((name) => name.startsWith('sb-') && name.includes('-auth-token'));
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
    if (url.pathname.startsWith('//') || url.pathname.startsWith('/\\')) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

/** Where a signed-in user on /login goes (#60): a safe ?redirect= or the role home; no role goes to /403. */
export function signedInLoginTarget(role: UserRole | null, redirect: unknown, origin: string): string {
  const home = roleHome(role);
  if (!home) return '/403';
  const target = safeRedirect(redirect, origin);
  if (target === '/' || target === '/login' || target.startsWith('/login?') || target.startsWith('/login#')) return home;
  return target;
}
