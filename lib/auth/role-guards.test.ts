import { describe, it, expect } from 'vitest';
import { isRouteAllowed, getAllowedRoles, isPublicRoute, safeRedirect, roleHome, hadSession, type UserRole } from './role-guards';

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
  it('allowlists public routes only', () => {
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/403')).toBe(true);
    expect(isPublicRoute('/api/auth/signout')).toBe(true);
    expect(isPublicRoute('/api/health')).toBe(true);
    expect(isPublicRoute('/ui')).toBe(true);
    expect(isPublicRoute('/health')).toBe(true);
    expect(isPublicRoute('/dev-error')).toBe(true);
    expect(isPublicRoute('/')).toBe(false);
  });
  it('does not treat lookalike paths as public (#13)', () => {
    expect(isPublicRoute('/api/healthz')).toBe(false);
    expect(isPublicRoute('/api/health/')).toBe(false);
    expect(isPublicRoute('/healthz')).toBe(false);
    expect(isPublicRoute('/403/x')).toBe(false);
  });
  it('maps each role to its home', () => {
    expect(roleHome('admin')).toBe('/admin');
    expect(roleHome('staff')).toBe('/staff');
    expect(roleHome('board_viewer')).toBe('/board');
    expect(roleHome(null)).toBeNull();
    expect(roleHome('owner' as UserRole)).toBeNull();
  });
  it('detects a prior Supabase session cookie', () => {
    expect(hadSession(['sb-127-auth-token'])).toBe(true);
    expect(hadSession(['sb-abc-auth-token.0', 'other'])).toBe(true);
    expect(hadSession(['other', 'sb-abc-code-verifier'])).toBe(false);
    expect(hadSession([])).toBe(false);
  });
  const origin = 'http://localhost:3000';
  it.each([
    ['/%5Cevil.com', '/'],
    ['/%5C/evil.com', '/'],
    ['/%09/evil.com', '/'],
    ['/%0A/evil.com', '/'],
    ['/\\evil.com', '/'],
    ['//evil.com', '/'],
    ['https://evil.com', '/'],
    ['javascript:alert(1)', '/'],
    ['', '/'],
    [null, '/'],
    ['/.//evil.com', '/'],
    ['/..//evil.com', '/'],
    ['/%2e%2e//evil.com', '/'],
    ['/a/..//evil.com', '/'],
    ['/staff/..//evil.com', '/'],
    ['/staff', '/staff'],
    ['/board?x=1#y', '/board?x=1#y'],
  ])('safeRedirect(%j) → %j', (input, expected) => {
    expect(safeRedirect(input, origin)).toBe(expected);
  });
});
