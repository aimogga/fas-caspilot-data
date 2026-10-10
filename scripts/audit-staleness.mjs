#!/usr/bin/env node
import { pathToFileURL } from 'url';

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
export const FUTURE_SKEW_MS = 5 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 15000;
export const WORKFLOW_FILE = 'nightly-audit.yml';

function runCreatedAt(run) {
  const s = run?.created_at;
  if (typeof s !== 'string' || !s.trim()) return null;
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : null;
}

function isScheduleSuccessOnMain(run) {
  if (!run || typeof run !== 'object' || Array.isArray(run)) return false;
  if (run.event !== 'schedule') return false;
  if (run.head_branch !== 'main' && run.branch !== 'main') return false;
  return run.conclusion === 'success' || run.status === 'success';
}

function parsePayload(apiJson) {
  let data = apiJson;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); }
    catch { return null; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (!Array.isArray(data.workflow_runs)) return null;
  return data;
}

/** Pure: API JSON + current time. Never passes vacuously. Uses created_at only. */
export function evaluateStaleness(apiJson, now) {
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    return { ok: false, reason: 'invalid now' };
  }
  const data = parsePayload(apiJson);
  if (!data) return { ok: false, reason: 'malformed JSON' };
  let newest = null;
  for (const run of data.workflow_runs) {
    if (!isScheduleSuccessOnMain(run)) continue;
    const at = runCreatedAt(run);
    if (at == null) return { ok: false, reason: 'malformed JSON' };
    if (at - now > FUTURE_SKEW_MS) return { ok: false, reason: 'future-dated run' };
    if (newest == null || at > newest) newest = at;
  }
  if (newest == null) return { ok: false, reason: 'no successful schedule run' };
  if (now - newest >= STALE_AFTER_MS) return { ok: false, reason: 'stale' };
  return { ok: true, ageMs: now - newest };
}

function fail(msg) {
  console.error(`Nightly Audit staleness: ${msg}`);
  return 1;
}

export async function main(opts = {}) {
  try {
    if ((opts.fixture ?? process.env.AUDIT_STALENESS_FIXTURE) === 'stale') {
      const r = evaluateStaleness({
        workflow_runs: [{
          event: 'schedule',
          head_branch: 'main',
          conclusion: 'success',
          created_at: '2026-10-08T12:00:00.000Z',
        }],
      }, Date.parse('2026-10-10T12:00:00.000Z'));
      return r.ok ? 0 : fail(r.reason);
    }
    const token = opts.token ?? process.env.GITHUB_TOKEN;
    const repo = opts.repo ?? process.env.GITHUB_REPOSITORY;
    if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      return fail('missing or invalid GITHUB_TOKEN/GITHUB_REPOSITORY');
    }
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?event=schedule&branch=main&status=success&per_page=20`;
    const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
    let res;
    try {
      res = await (opts.fetch ?? globalThis.fetch)(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      return fail(`API error${e instanceof Error ? `: ${e.message}` : ''}`);
    }
    if (!res || res.status !== 200) return fail(`non-200 ${res && res.status}`);
    let text;
    try { text = await res.text(); }
    catch { return fail('API error'); }
    let json;
    try { json = JSON.parse(text); }
    catch { return fail('malformed JSON'); }
    const r = evaluateStaleness(json, opts.now ?? Date.now());
    if (!r.ok) return fail(r.reason);
    console.log(`Nightly Audit staleness: ok (${Math.round(r.ageMs / 60000)}m ago)`);
    return 0;
  } catch {
    return fail('unexpected error');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c ?? 1)).catch(() => process.exit(1));
}
