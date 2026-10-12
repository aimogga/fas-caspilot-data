export type UserRole = 'admin' | 'staff' | 'board_viewer';
const ALL: UserRole[] = ['admin', 'staff', 'board_viewer'];
const RULES: Record<string, UserRole[]> = {
  '/login': ALL, '/': ALL, '/staff': ['admin', 'staff'], '/admin': ['admin'], '/board': ALL,
};
const GUARDED_PREFIXES = ['/admin', '/staff', '/board'] as const;
export type GuardedPrefix = (typeof GUARDED_PREFIXES)[number];

/** Role-home prefix on a path segment (#63). Case-sensitive, like RULES. */
export function matchGuardedPrefix(path: string): GuardedPrefix | null {
  for (const prefix of GUARDED_PREFIXES) {
    if (path === prefix) {
      return prefix;
    }
    if (path.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }
  return null;
}

export function isRouteAllowed(path: string, role: UserRole | null): boolean {
  if (!role) {
    return false;
  }
  const key = matchGuardedPrefix(path) ?? path;
  return RULES[key]?.includes(role) ?? false;
}
export function getAllowedRoles(path: string): UserRole[] {
  const key = matchGuardedPrefix(path) ?? path;
  return RULES[key] ?? [];
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
