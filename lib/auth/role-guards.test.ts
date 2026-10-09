import { describe, it, expect } from 'vitest';
import { isRouteAllowed, getAllowedRoles, isPublicRoute, type UserRole } from './role-guards';

describe('role-guards', () => {
  describe('isRouteAllowed', () => {
    it('allows admin to access all routes', () => {
      const adminRole: UserRole = 'admin';
      expect(isRouteAllowed('/', adminRole)).toBe(true);
      expect(isRouteAllowed('/staff', adminRole)).toBe(true);
      expect(isRouteAllowed('/admin', adminRole)).toBe(true);
      expect(isRouteAllowed('/board', adminRole)).toBe(true);
      expect(isRouteAllowed('/login', adminRole)).toBe(true);
    });

    it('allows staff to access home, staff, and board', () => {
      const staffRole: UserRole = 'staff';
      expect(isRouteAllowed('/', staffRole)).toBe(true);
      expect(isRouteAllowed('/staff', staffRole)).toBe(true);
      expect(isRouteAllowed('/board', staffRole)).toBe(true);
      expect(isRouteAllowed('/login', staffRole)).toBe(true);
    });

    it('denies staff access to admin page', () => {
      const staffRole: UserRole = 'staff';
      expect(isRouteAllowed('/admin', staffRole)).toBe(false);
    });

    it('allows board_viewer to access home, board, and login only', () => {
      const boardRole: UserRole = 'board_viewer';
      expect(isRouteAllowed('/', boardRole)).toBe(true);
      expect(isRouteAllowed('/board', boardRole)).toBe(true);
      expect(isRouteAllowed('/login', boardRole)).toBe(true);
    });

    it('denies board_viewer access to staff and admin pages', () => {
      const boardRole: UserRole = 'board_viewer';
      expect(isRouteAllowed('/staff', boardRole)).toBe(false);
      expect(isRouteAllowed('/admin', boardRole)).toBe(false);
    });

    it('denies access to all routes when role is null', () => {
      expect(isRouteAllowed('/', null)).toBe(false);
      expect(isRouteAllowed('/staff', null)).toBe(false);
      expect(isRouteAllowed('/admin', null)).toBe(false);
      expect(isRouteAllowed('/board', null)).toBe(false);
      expect(isRouteAllowed('/login', null)).toBe(false);
    });

    it('returns false for unknown routes', () => {
      const adminRole: UserRole = 'admin';
      expect(isRouteAllowed('/unknown', adminRole)).toBe(false);
    });
  });

  describe('getAllowedRoles', () => {
    it('returns correct allowed roles for each route', () => {
      expect(getAllowedRoles('/')).toEqual(['admin', 'staff', 'board_viewer']);
      expect(getAllowedRoles('/staff')).toEqual(['admin', 'staff']);
      expect(getAllowedRoles('/admin')).toEqual(['admin']);
      expect(getAllowedRoles('/board')).toEqual(['admin', 'staff', 'board_viewer']);
      expect(getAllowedRoles('/login')).toEqual(['admin', 'staff', 'board_viewer']);
    });

    it('returns empty array for unknown routes', () => {
      expect(getAllowedRoles('/unknown')).toEqual([]);
    });
  });

  describe('isPublicRoute', () => {
    it('returns true for login page', () => {
      expect(isPublicRoute('/login')).toBe(true);
    });

    it('returns true for auth API routes', () => {
      expect(isPublicRoute('/api/auth/callback')).toBe(true);
      expect(isPublicRoute('/api/auth/signout')).toBe(true);
    });

    it('returns false for protected routes', () => {
      expect(isPublicRoute('/')).toBe(false);
      expect(isPublicRoute('/staff')).toBe(false);
      expect(isPublicRoute('/admin')).toBe(false);
      expect(isPublicRoute('/board')).toBe(false);
    });
  });
});
