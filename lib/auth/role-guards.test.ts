import { describe, it, expect } from 'vitest';
import { isRouteAllowed, getAllowedRoles, isPublicRoute, safeRedirect, roleHome, hadSession, signedInLoginTarget, matchGuardedPrefix, canonicalizePath, isNoroleAllowed, type UserRole } from './role-guards';

describe('role-guards', () => {
  const routes = ['/', '/staff', '/admin', '/board', '/login', '/dashboard', '/dashboard/m1'];
  const roles: (UserRole | null)[] = ['admin', 'staff', 'board_viewer', null];
  const expectations: Record<string, boolean[]> = {
    '/': [true, true, true, false],
    '/staff': [true, true, false, false],
    '/admin': [true, false, false, false],
    '/board': [true, true, true, false],
    '/login': [true, true, true, false],
    '/dashboard': [true, true, false, false],
    '/dashboard/m1': [true, true, false, false],
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
    expect(getAllowedRoles('/staff/reports')).toEqual(['admin', 'staff']);
    expect(getAllowedRoles('/administrator')).toEqual([]);
  });
  it('applies the role map to nested prefix paths', () => {
    expect(isRouteAllowed('/staff/reports', 'staff')).toBe(true);
    expect(isRouteAllowed('/staff/reports', 'admin')).toBe(true);
    expect(isRouteAllowed('/staff/reports', 'board_viewer')).toBe(false);
    expect(isRouteAllowed('/admin/users', 'admin')).toBe(true);
    expect(isRouteAllowed('/admin/users', 'staff')).toBe(false);
    expect(isRouteAllowed('/board/packets', 'board_viewer')).toBe(true);
    expect(isRouteAllowed('/administrator', 'admin')).toBe(false);
    expect(isRouteAllowed('/need-map', 'board_viewer')).toBe(true);
    expect(isRouteAllowed('/need-map', 'staff')).toBe(true);
    expect(isRouteAllowed('/need-map', null)).toBe(false);
    expect(matchGuardedPrefix('/need-map')).toBe('/need-map');
    expect([...(['board_viewer', 'staff', 'admin'] as const), null].map((r) => isRouteAllowed('/methodology', r))).toEqual([true, true, true, false]);
    expect(matchGuardedPrefix('/methodology')).toBe('/methodology');
    expect([...(['board_viewer', 'staff', 'admin'] as const), null].map((r) => isRouteAllowed('/data-freshness', r))).toEqual([false, true, true, false]);
    expect(isRouteAllowed('/Data-Freshness/x', 'board_viewer')).toBe(false);
    expect(getAllowedRoles('/data-freshness')).toEqual(['admin', 'staff']);
    expect(matchGuardedPrefix('/data-freshness')).toBe('/data-freshness');
    expect([...(['board_viewer', 'staff', 'admin'] as const), null].map((r) => isRouteAllowed('/api/packets/export', r))).toEqual([false, true, true, false]);
    expect(matchGuardedPrefix('/api/packets/export')).toBe('/api/packets');
  });
  it('allowlists public routes only', () => {
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/403')).toBe(true);
    expect(isPublicRoute('/api/auth/signout')).toBe(true);
    expect(isPublicRoute('/api/auth/login')).toBe(true);
    expect(isPublicRoute('/api/health')).toBe(true);
    expect(isPublicRoute('/api/ingest/sahie')).toBe(true);
    expect(isPublicRoute('/api/ingest/saipe')).toBe(true);
    expect(isPublicRoute('/api/ingest/acs')).toBe(true);
    expect(isPublicRoute('/api/ingest/need-score')).toBe(true);
    expect(isPublicRoute('/ui')).toBe(true);
    expect(isPublicRoute('/health')).toBe(true);
    expect(isPublicRoute('/dev-error')).toBe(true);
    expect(isPublicRoute('/')).toBe(false);
  });
  it('does not treat lookalike paths as public (#13)', () => {
    expect(isPublicRoute('/api/healthz')).toBe(false);
    expect(isPublicRoute('/api/auth/login/')).toBe(false);
    expect(isPublicRoute('/api/auth/loginz')).toBe(false);
    expect(isPublicRoute('/api/health/')).toBe(false);
    expect(isPublicRoute('/api/ingest/sahie/')).toBe(false);
    expect(isPublicRoute('/api/ingest/saipe/')).toBe(false);
    expect(isPublicRoute('/api/ingest/acs/')).toBe(false);
    expect(isPublicRoute('/api/ingest/need-score/')).toBe(false);
    expect(isPublicRoute('/api/ingest')).toBe(false);
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
  describe('signedInLoginTarget (#60)', () => {
    const origin = 'http://localhost:3000';
    it.each([
      ['admin', null, '/admin'],
      ['staff', null, '/staff'],
      ['board_viewer', null, '/board'],
      ['board_viewer', '/board?tab=1', '/board?tab=1'],
      ['staff', '/admin', '/admin'],
      ['admin', 'https://evil.example/x', '/admin'],
      ['admin', '//evil.example', '/admin'],
      ['staff', '/login', '/staff'],
      ['staff', '/login?redirect=%2Fstaff', '/staff'],
      ['staff', '/', '/staff'],
      [null, '/staff', '/403'],
      [null, null, '/403'],
    ] as const)('%s with redirect %j → %j', (role, redirect, expected) => {
      expect(signedInLoginTarget(role, redirect, origin)).toBe(expected);
    });
  });
  describe('matchGuardedPrefix (#63)', () => {
    it.each([
      ['/admin', '/admin'],
      ['/admin/', '/admin'],
      ['/admin/users', '/admin'],
      ['/admin/users/1', '/admin'],
      ['/staff', '/staff'],
      ['/staff/', '/staff'],
      ['/staff/cases/new', '/staff'],
      ['/board', '/board'],
      ['/board/', '/board'],
      ['/board/packets', '/board'],
    ] as const)('known prefix %j → %j', (path, expected) => {
      expect(matchGuardedPrefix(path)).toBe(expected);
    });
    it.each([
      '/',
      '/login',
      '/403',
      '/no-such-page',
      '/reports',
      '/api/health',
    ])('unknown path %j → null', (path) => {
      expect(matchGuardedPrefix(path)).toBeNull();
    });
    it.each([
      '/administrator',
      '/staffing',
      '/boardroom',
      '/admin2',
      '/admin-tools',
      '/staff_home',
    ])('look-alike path %j → null', (path) => {
      expect(matchGuardedPrefix(path)).toBeNull();
    });
    it.each([
      '/Admin',
      '/ADMIN',
      '/Staff',
      '/Board',
      '/Admin/users',
    ])('does not fold letter case (%j)', (path) => {
      expect(matchGuardedPrefix(path)).toBeNull();
    });
    it('keeps matching when only later segments differ in case', () => {
      expect(matchGuardedPrefix('/staff/Reports')).toBe('/staff');
      expect(matchGuardedPrefix('/admin/Users')).toBe('/admin');
    });
  });
  describe('canonicalizePath (#63)', () => {
    it.each([
      ['/%61dmin', '/admin'],
      ['/%73taff', '/staff'],
      ['/%2561dmin', '/admin'],
      ['/admin%2Fusers', '/admin/users'],
      ['/Admin', '/admin'],
      ['//admin', '/admin'],
      ['///staff', '/staff'],
      ['/./admin', '/admin'],
      ['/x/../admin', '/admin'],
      ['/admin/', '/admin'],
      ['/a%20b', '/a b'],
      ['/caf%C3%A9', '/café'],
      ['/%2F%2Fevil.com', '/evil.com'],
    ] as const)('%j → %j', (input, expected) => {
      expect(canonicalizePath(input)).toBe(expected);
    });
    it('fails closed on malformed encoding', () => {
      expect(canonicalizePath('/%')).toBeNull();
      expect(canonicalizePath('/%zz')).toBeNull();
      expect(isRouteAllowed('/%zz', 'admin')).toBe(false);
    });
    it.each([
      '/%5C%5Cevil.com',
      '/%2F%5Cevil.com',
      '/%5Cevil.com',
      '/%5C/evil.com',
    ])('null for backslash trick %j', (path) => {
      expect(canonicalizePath(path)).toBeNull();
    });
    it('guards encoded prefixes with the role map', () => {
      expect(isRouteAllowed('/%61dmin', 'admin')).toBe(true);
      expect(isRouteAllowed('/%61dmin', 'staff')).toBe(false);
      expect(isRouteAllowed('/%73taff', 'staff')).toBe(true);
      expect(isRouteAllowed('/%73taff', 'board_viewer')).toBe(false);
      expect(isRouteAllowed('/%2561dmin', 'staff')).toBe(false);
      expect(isRouteAllowed('/%2561dmin', 'admin')).toBe(true);
      expect(isRouteAllowed('/admin%2Fusers', 'admin')).toBe(true);
      expect(isRouteAllowed('/admin%2Fusers', 'staff')).toBe(false);
      expect(matchGuardedPrefix(canonicalizePath('/%61dmin') ?? '')).toBe('/admin');
    });
  });
  describe('isNoroleAllowed', () => {
    it('allows only 403, login, and logout', () => {
      expect(isNoroleAllowed('/403')).toBe(true);
      expect(isNoroleAllowed('/login')).toBe(true);
      expect(isNoroleAllowed('/api/auth/signout')).toBe(true);
    });
    it('denies guarded prefixes, public extras, and unknown paths', () => {
      expect(isNoroleAllowed('/admin')).toBe(false);
      expect(isNoroleAllowed('/staff')).toBe(false);
      expect(isNoroleAllowed('/board')).toBe(false);
      expect(isNoroleAllowed('/')).toBe(false);
      expect(isNoroleAllowed('/ui')).toBe(false);
      expect(isNoroleAllowed('/api/health')).toBe(false);
      expect(isNoroleAllowed('/administrator')).toBe(false);
      expect(isNoroleAllowed('/%zz')).toBe(false);
    });
  });
});
