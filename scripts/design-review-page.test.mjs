import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildHtml, main } from './design-review-page.mjs';

const row = (id, tag, route, width, variant, at, sha = 'abc1234') => ({ id, tag, route, width, variant, host: '127.0.0.1', sha, at });
const older = [row('DS-09', 'before', '/staff', 375, 'base', '2026-10-10T10:00:00.000Z', '0ld0000'), row('DS-09', 'after', '/staff', 375, 'base', '2026-10-10T11:00:00.000Z', '0ld0000')];
const newer = [
  row('DS-10a', 'before', '/staff', 375, 'base', '2026-10-15T10:00:00.000Z'),
  row('DS-10a', 'before', '/staff', 1024, 'base', '2026-10-15T10:00:01.000Z'),
  row('DS-10a', 'after', '/staff', 375, 'base', '2026-10-15T12:00:00.000Z', 'def5678'),
  row('DS-10a', 'after', '/staff', 1024, 'base', '2026-10-15T12:00:01.000Z', 'def5678'),
  row('DS-10a', 'after', '/staff', 1024, 'dark', '2026-10-15T12:00:02.000Z', 'def5678'),
  row('DS-10a', 'after', '/staff', 816, 'print', '2026-10-15T12:00:03.000Z', 'def5678'),
  row('DS-10a', 'before', '/need-map?county=49035', 1440, 'hover', '2026-10-15T10:00:05.000Z'),
];

describe('buildHtml', () => {
  const html = buildHtml([older, newer]);

  it('writes one section per route for the newest packet only, base widths before the variants', () => {
    expect(html.match(/<section /g)).toHaveLength(2);
    expect(html).toContain('<h2>/staff · DS-10a</h2>');
    expect(html).toContain('<h2>/need-map?county=49035 · DS-10a</h2>');
    expect(html).not.toContain('DS-09');
    const at = ['375 · base', '1024 · base', '816 · print', '1024 · dark'].map((h) => html.indexOf(`<h3>${h}</h3>`));
    expect(at.every((i, n) => i > 0 && (n === 0 || i > at[n - 1]))).toBe(true);
  });

  it('captions every figure with id, tag, width and sha, and pairs before with after side by side', () => {
    expect(html).toContain('<b>before</b> DS-10a · before · 375 · <code>abc1234</code>');
    expect(html).toContain('<b>after</b> DS-10a · after · 375 · <code>def5678</code>');
    const pair = html.slice(html.indexOf('<h3>375 · base</h3>'), html.indexOf('<h3>1024 · base</h3>'));
    expect(pair.match(/<figure>/g)).toHaveLength(2);
    expect(pair).toContain('src="DS-10a/before/staff-375.png"');
    expect(pair).toContain('src="DS-10a/after/staff-375.png"');
    expect(html).toContain('src="DS-10a/after/staff-816-print.png"');
    expect(html).toContain('src="DS-10a/before/need-map-county-49035-1440-hover.png"');
  });

  it('uses relative image paths only, no external assets, escapes text, and has an empty state', () => {
    expect(html).not.toMatch(/src="(\/|file:|https?:)/);
    expect(html).not.toContain(process.cwd());
    expect(html).not.toMatch(/<link |<script/);
    expect(html).toContain('oklch(0.975 0.008 85)');
    expect(buildHtml([[row('DS-1', 'after', '/x?a=<b>', 375, 'base', '2026-01-01T00:00:00.000Z')]])).toContain('<h2>/x?a=&lt;b&gt; · DS-1</h2>');
    expect(buildHtml([])).toContain('No shots yet');
  });
});

describe('main', () => {
  it('reads every <id>/manifest.json under the root and writes index.html beside them', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'reviews-'));
    mkdirSync(path.join(root, 'DS-10a'));
    mkdirSync(path.join(root, 'empty'));
    writeFileSync(path.join(root, 'DS-10a', 'manifest.json'), JSON.stringify(newer));
    expect(main(root)).toEqual({ out: path.join(root, 'index.html'), packets: 1 });
    expect(readFileSync(path.join(root, 'index.html'), 'utf-8')).toContain('<h2>/staff · DS-10a</h2>');
  });
});
