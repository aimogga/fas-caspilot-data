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
  return path === '/login' || path.startsWith('/api/');
}
export function safeRedirect(path: string | null): string {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}
