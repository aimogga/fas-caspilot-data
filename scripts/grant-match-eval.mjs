#!/usr/bin/env node
// F-509: run the grant match eval locally (`pnpm eval:grants [labels.json] [--write-golden]`). Prints the report; exits 1 below the bars.
// Loads the TypeScript rules layer directly with Node's type stripping; the resolve hook adds `.ts` to the extensionless imports in lib/grants.
import { register } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const hook = `export async function resolve(spec, ctx, next) {
  if (!/^\\.\\.?\\//.test(spec) || /\\.[cm]?[jt]s$/.test(spec)) return next(spec, ctx);
  try { return await next(spec, ctx); } catch (e) { if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e; return next(spec + '.ts', ctx); }
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`, pathToFileURL(import.meta.filename));

const { runEval, formatReport, EVAL_BARS } = await import('../lib/grants/eval.ts');
const { V0_DRAFT_CONFIG } = await import('../lib/grants/config-defaults.ts');
const { FAS_PROFILE_SYNTHETIC } = await import('../lib/grants/profile.ts');

const args = process.argv.slice(2);
const labelsPath = args.find((a) => !a.startsWith('--')) ?? 'tests/eval/grant-match/labels.json';
const { as_of, labels } = JSON.parse(readFileSync(labelsPath, 'utf8'));
const report = runEval(labels, V0_DRAFT_CONFIG, FAS_PROFILE_SYNTHETIC, new Date(as_of));
console.log(formatReport(report, V0_DRAFT_CONFIG.id));
if (args.includes('--write-golden')) { // a scorer or label change regenerates tests/golden/match-eval.json on purpose, never by accident
  const { misses, ...rest } = report;
  const head = `  "_about": "F-509 golden: v0-draft on ${labelsPath}. Regenerate with: pnpm eval:grants --write-golden (see scripts/grant-match-eval.mjs).",`;
  const body = JSON.stringify({ config_id: V0_DRAFT_CONFIG.id, ...rest }).slice(1, -1);
  writeFileSync('tests/golden/match-eval.json', ['{', head, `  ${body},`, '  "misses": [', misses.map((m) => `    ${JSON.stringify(m)}`).join(',\n'), '  ]', '}', ''].join('\n'));
  console.log('wrote tests/golden/match-eval.json');
}
const failed = Object.keys(EVAL_BARS).filter((k) => report[k] < EVAL_BARS[k]);
if (failed.length) { console.error(`Below the bar: ${failed.join(', ')}`); process.exit(1); }
