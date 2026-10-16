## 2026-10-16 20:15 (UTC) — Claude Code (cloud, Engineer Supervisor) — CI keeps e2e screenshots as a run artifact (tooling)
Did: `.github/workflows/ci.yml` uploads every PNG the e2e run writes (`test-results/**`, `/opt/cursor/artifacts/**`) as the `e2e-screenshots` artifact, kept 14 days, also when the run fails. Asked for by #255 (F-508f): QA wants the six strategy-page shots in a reviewable place, CI already takes them and threw them away, and the preview can't generate drafts without calling the real model.
State: workflow-only change; lint, typecheck, unit tests green on main a5e9d59. Branch `claude/practical-rubin-9wc7zm` off main.
Left: QA reads the #255 shots from the run's artifact list.
Decisions: none new.
