import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';
import { parseYaml, assertCi } from './ci-structure.mjs';

const yml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const s = (name, run) => `      - name: ${name}\n        run: ${run}`;
const BASE = ['jobs:', '  secret-scan:', '    steps:', s('Secret scan', 'node scripts/nightly-audit.mjs --secrets-only'), '  ci:', '    steps:', s('Lint', 'pnpm lint'), s('Typecheck', 'pnpm typecheck'), s('Unit tests', 'pnpm test'), s('Database tests', 'pnpm test:db'), s('E2E smoke', 'pnpm test:e2e')].join('\n') + '\n';

describe('ci.yml', () => {
  it('parses and accepts allowlisted check runs', () => {
    const doc = parseYaml(yml);
    expect(doc.on.pull_request.branches).toEqual(['main']);
    expect(doc.permissions).toEqual({contents: 'read'});
    expect(() => assertCi(doc)).not.toThrow();
  });
  it.each([
    ['if: ${{ false }}', BASE.replace(s('Unit tests', 'pnpm test'), s('Unit tests', 'pnpm test').replace('        run:', '        if: ${{ false }}\n        run:'))],
    ['pnpm test; exit 0', BASE.replace('run: pnpm test', 'run: pnpm test; exit 0')],
    ['pnpm test --passWithNoTests nomatch', BASE.replace('run: pnpm test', 'run: pnpm test --passWithNoTests nomatch')],
    ['echo pnpm test', BASE.replace('run: pnpm test', 'run: echo pnpm test')],
    ['--secrets-only || :', BASE.replace('--secrets-only', '--secrets-only || :')],
  ])('rejects %s', (_n, src) => { expect(() => assertCi(parseYaml(src))).toThrow(); });
  it('rejects continue-on-error and a missing check step', () => {
    expect(() => assertCi(parseYaml(BASE.replace('  ci:', '  ci:\n    continue-on-error: true')))).toThrow();
    expect(() => assertCi(parseYaml(BASE.replace(s('E2E smoke', 'pnpm test:e2e') + '\n', '')))).toThrow();
  });
});
