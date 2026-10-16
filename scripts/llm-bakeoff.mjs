#!/usr/bin/env node
// F-508i: the D-003 LLM bake-off (`pnpm eval:llm [--date=YYYY-MM-DD]`). Needs LLM_EVAL=1 (the pnpm script sets it) and the provider keys in the env;
// a missing key or quota skips that provider's runs and the report says so. Writes harness/audits/llm-bakeoff-<date>.{json,md} plus drafts beside them.
// Loads lib/strategy with Node's type transform (lib/llm uses parameter properties) (resolve hook as in grant-match-eval.mjs, plus directory imports); `--conditions=react-server` makes `server-only` an empty module.
import { register } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const hook = `export async function resolve(spec, ctx, next) {
  if (!/^\\.\\.?\\//.test(spec) || /\\.[cm]?[jt]s$/.test(spec)) return next(spec, ctx);
  try { return await next(spec, ctx); } catch (e) {
    if (e?.code === 'ERR_UNSUPPORTED_DIR_IMPORT') return next(spec + '/index.ts', ctx);
    if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    return next(spec + '.ts', ctx);
  }
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`, pathToFileURL(import.meta.filename));

if (process.env.LLM_EVAL !== '1') { console.error('Set LLM_EVAL=1 (use `pnpm eval:llm`).'); process.exit(1); }
const { buildItems, runBakeoff, buildReport, outputs } = await import('../lib/strategy/bakeoff.ts');

const date = process.argv.find((a) => a.startsWith('--date='))?.slice(7) ?? new Date().toISOString().slice(0, 10);
const items = buildItems(JSON.parse(readFileSync('tests/eval/llm/opportunities.json', 'utf8')));
const runs = await runBakeoff(items);
const report = buildReport(runs, items, date);
for (const f of outputs(report, runs)) {
  const path = join('harness/audits', f.path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, f.content);
  console.log(`wrote ${path}`);
}
for (const r of runs.filter((x) => x.skipped)) console.log(`skipped ${r.provider} ${r.key}: ${r.reason}`);
console.log(`automatic leader: ${report.automatic_leader ?? 'none (tie or no data)'}`);
