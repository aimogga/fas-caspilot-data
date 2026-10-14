import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { isPublicRoute, matchGuardedPrefix } from './role-guards';

const APP_DIR = join(__dirname, '..', '..', 'app');
const DEFAULT_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];
const EXTENSIONS = nextConfig.pageExtensions ?? DEFAULT_EXTENSIONS;

class RouteCoverage {
  static collect(dir: string, segments: string[] = []): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && RouteCoverage.isRouteFile(entry.name)) {
        found.push(RouteCoverage.toPath(segments));
      }
      if (!entry.isDirectory() || entry.name.startsWith('_')) {
        continue;
      }
      const isGroup = entry.name.startsWith('(') && entry.name.endsWith(')');
      const next = isGroup ? segments : [...segments, entry.name];
      found.push(...RouteCoverage.collect(join(dir, entry.name), next));
    }
    return found;
  }

  static isRouteFile(name: string): boolean {
    const dot = name.lastIndexOf('.');
    const base = name.slice(0, dot);
    const ext = name.slice(dot + 1);
    return (base === 'page' || base === 'route') && EXTENSIONS.includes(ext);
  }

  static toPath(segments: string[]): string {
    return `/${segments.join('/')}`;
  }

  static isCovered(path: string): boolean {
    if (path === '/') {
      return true;
    }
    if (matchGuardedPrefix(path) !== null) {
      return true;
    }
    if (path.includes('[')) {
      return false;
    }
    return isPublicRoute(path);
  }
}

describe('route guard coverage (#79)', () => {
  const routes = RouteCoverage.collect(APP_DIR);

  it('finds the app routes', () => {
    expect(routes).toContain('/admin');
    expect(routes).toContain('/login');
    expect(routes).toContain('/api/health');
    expect(routes).toContain('/data-freshness');
  });

  it('strips route groups and skips private folders', () => {
    expect(routes.some((path) => path.includes('('))).toBe(false);
    expect(routes.some((path) => path.split('/').some((part) => part.startsWith('_')))).toBe(false);
  });

  it('treats page.* and route.* with any page extension as route files', () => {
    expect(RouteCoverage.isRouteFile('page.js')).toBe(true);
    expect(RouteCoverage.isRouteFile('route.js')).toBe(true);
    expect(RouteCoverage.isRouteFile('page.jsx')).toBe(true);
    expect(RouteCoverage.isRouteFile('route.tsx')).toBe(true);
    expect(RouteCoverage.isRouteFile('page.ts')).toBe(true);
    expect(RouteCoverage.isRouteFile('layout.tsx')).toBe(false);
    expect(RouteCoverage.isRouteFile('page.css')).toBe(false);
  });

  it('guards or allowlists every app route', () => {
    const unguarded = routes.filter((path) => !RouteCoverage.isCovered(path));
    expect(unguarded).toEqual([]);
  });

  it('fails an unguarded top-level route', () => {
    expect(RouteCoverage.isCovered('/reports')).toBe(false);
  });

  it('fails a dynamic segment outside a guarded prefix', () => {
    expect(RouteCoverage.isCovered('/[id]')).toBe(false);
    expect(RouteCoverage.isCovered('/staff/[id]')).toBe(true);
  });
});
