import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPublicRoute, matchGuardedPrefix } from './role-guards';

const APP_DIR = join(__dirname, '..', '..', 'app');
const ROUTE_FILES = ['page.tsx', 'route.ts'];

class RouteCoverage {
  static collect(dir: string, segments: string[] = []): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && ROUTE_FILES.includes(entry.name)) {
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
  });

  it('strips route groups and skips private folders', () => {
    expect(routes.some((path) => path.includes('('))).toBe(false);
    expect(routes.some((path) => path.split('/').some((part) => part.startsWith('_')))).toBe(false);
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
