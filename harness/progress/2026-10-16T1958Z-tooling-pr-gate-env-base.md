## 2026-10-16 04:15 (UTC) — Claude Code (cloud, Engineer) — pr-gate PR_GATE_BASE override (D-028, D-032)
Did: `resolveBase` in `scripts/pr-gate.mjs` (from #239) also reads `PR_GATE_BASE`, after `--base` and before `branch.<name>.gateBase`. Like `gateBase`, it must be an `origin/*` branch: a shared `originRef` check throws `PR_GATE_BASE must be an origin/* branch` otherwise. It is for a one-off or CI run against a parent without setting git config. The push hook runs `pnpm gate`, which inherits the env. The usage line documents it. 1 new unit test (precedence and refusal); the CLI was checked with `PR_GATE_BASE=origin/main` (base printed) and `=HEAD` (refused).
State: lint, typecheck, unit tests and `pnpm gate` green. Branch `tooling/pr-gate-env-base`. Supersedes nothing; #258 (an earlier duplicate of #239) was closed.
Left: nothing.
Decisions: none new.
