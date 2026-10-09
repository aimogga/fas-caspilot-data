export type UserRole = 'admin' | 'staff' | 'board_viewer';

export interface RouteAccess {
  path: string;
  allowedRoles: UserRole[];
}

const ROUTE_ACCESS_RULES: RouteAccess[] = [
  { path: '/login', allowedRoles: ['admin', 'staff', 'board_viewer'] },
  { path: '/', allowedRoles: ['admin', 'staff', 'board_viewer'] },
  { path: '/staff', allowedRoles: ['admin', 'staff'] },
  { path: '/admin', allowedRoles: ['admin'] },
  { path: '/board', allowedRoles: ['admin', 'staff', 'board_viewer'] },
];

export function isRouteAllowed(path: string, userRole: UserRole | null): boolean {
  if (!userRole) {
    return false;
  }

  const rule = ROUTE_ACCESS_RULES.find((r) => r.path === path);
  if (!rule) {
    return false;
  }

  return rule.allowedRoles.includes(userRole);
}

export function getAllowedRoles(path: string): UserRole[] {
  const rule = ROUTE_ACCESS_RULES.find((r) => r.path === path);
  return rule?.allowedRoles || [];
}

export function isPublicRoute(path: string): boolean {
  return path === '/login' || path.startsWith('/api/auth');
}
