import { describe, it, expect } from 'vitest';
import { isRouteAllowed, getAllowedRoles, isPublicRoute, safeRedirect, type UserRole } from './role-guards';

describe('role-guards', () => {
  const routes = ['/', '/staff', '/admin', '/board', '/login'];
  const roles: (UserRole | null)[] = ['admin', 'staff', 'board_viewer', null];
  const expectations: Record<string, boolean[]> = {
    '/': [true, true, true, false],
    '/staff': [true, true, false, false],
    '/admin': [true, false, false, false],
    '/board': [true, true, true, false],
    '/login': [true, true, true, false],
  };
  it.each(roles)('validates route access for %s', (role) => {
    routes.forEach((route) => {
      const idx = roles.indexOf(role);
      expect(isRouteAllowed(route, role)).toBe(expectations[route][idx]);
    });
  });
  it('returns correct allowed roles', () => {
    expect(getAllowedRoles('/')).toEqual(['admin', 'staff', 'board_viewer']);
    expect(getAllowedRoles('/staff')).toEqual(['admin', 'staff']);
    expect(getAllowedRoles('/admin')).toEqual(['admin']);
  });
  it('identifies public routes and safe redirects', () => {
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/api/auth/signout')).toBe(true);
    expect(isPublicRoute('/')).toBe(false);
    expect(safeRedirect('/staff')).toBe('/staff');
    expect(safeRedirect('//evil')).toBe('/');
    expect(safeRedirect('https://evil')).toBe('/');
  });
});
