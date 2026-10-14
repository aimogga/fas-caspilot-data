export type UserRole = 'admin' | 'staff' | 'board_viewer';
const ALL: UserRole[] = ['admin', 'staff', 'board_viewer'];
const RULES: Record<string, UserRole[]> = {
  '/login': ALL, '/': ALL, '/staff': ['admin', 'staff'], '/admin': ['admin'], '/board': ALL, '/dashboard': ['admin', 'staff'], '/need-map': ALL, '/methodology': ALL,
};
const GUARDED_PREFIXES = ['/admin', '/staff', '/board', '/dashboard', '/need-map', '/methodology'] as const;
export type GuardedPrefix = (typeof GUARDED_PREFIXES)[number];
const DECODE_PASSES = 8;
const NOROLE_ALLOWED = ['/403', '/login', '/api/auth/signout'] as const;

function decodeFully(path: string): string | null {
  let current = path;
  for (let pass = 0; pass < DECODE_PASSES; pass++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (next === current) {
      return current;
    }
    current = next;
  }
  return null;
}

function resolvePathSegments(path: string): string {
  const parts = path.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      if (out.length > 0) {
        out.pop();
      }
      continue;
    }
    out.push(part);
  }
  if (out.length === 0) {
    return '/';
  }
  return `/${out.join('/')}`;
}

/** Decode fully, lowercase, collapse slashes, resolve `.`/`..`. Null fails closed. */
export function canonicalizePath(path: string): string | null {
  const decoded = decodeFully(path);
  if (decoded === null) {
    return null;
  }
  if (/[\u0000-\u001F\u007F]/.test(decoded)) {
    return null;
  }
  if (decoded.includes('\\')) {
    return null;
  }
  const resolved = resolvePathSegments(decoded.toLowerCase());
  if (resolved.includes('\\') || resolved.startsWith('//')) {
    return null;
  }
  return resolved;
}

/** Role-home prefix on a path segment (#63). Callers pass a canonical path. */
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

export function isNoroleAllowed(path: string): boolean {
  const canonical = canonicalizePath(path);
  if (canonical === null) {
    return false;
  }
  for (const allowed of NOROLE_ALLOWED) {
    if (canonical === allowed) {
      return true;
    }
  }
  return false;
}

export function isRouteAllowed(path: string, role: UserRole | null): boolean {
  if (!role) {
    return false;
  }
  const canonical = canonicalizePath(path);
  if (canonical === null) {
    return false;
  }
  const key = matchGuardedPrefix(canonical) ?? canonical;
  return RULES[key]?.includes(role) ?? false;
}
export function getAllowedRoles(path: string): UserRole[] {
  const canonical = canonicalizePath(path);
  if (canonical === null) {
    return [];
  }
  const key = matchGuardedPrefix(canonical) ?? canonical;
  return RULES[key] ?? [];
}
const HOME: Record<UserRole, string> = { admin: '/admin', staff: '/staff', board_viewer: '/board' };
export function roleHome(role: UserRole | null): string | null {
  return role ? HOME[role] ?? null : null;
}
export function isPublicRoute(path: string): boolean {
  return path === '/login' || path === '/403' || path === '/api/auth/signout' || path === '/api/auth/login' || path === '/api/health'
    || path === '/api/ingest/sahie' || path === '/api/ingest/saipe' || path === '/api/ingest/acs' || path === '/api/ingest/need-score'
    || path === '/ui' || path === '/health' || path === '/dev-error';
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
