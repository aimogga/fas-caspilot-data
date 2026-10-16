## 2026-10-16 01:05 (UTC) — Cloud Agent (Engineer) — F-508c part 2: staff read-only FAS knowledge and evidence shots (F-508)
Did: `/staff/knowledge` lists approved entries and approved versions only, with no edit, status or add controls (RLS already hides drafts and archived rows from staff); the loader moved to `lib/knowledge/load.ts` and is shared with `/admin/knowledge`. Staff nav gets a "Grant writing" group with "FAS knowledge"; crumb added; layout-parity covers the route. e2e: an admin approves a fictional entry in its own context, staff see it with no controls and the status hint on focus, board gets 403. After shots in `docs/design/reviews/F-508c/after/` (admin 375/1024/1440 + hover, staff 375/1024/1440) from the synthetic seed on local Supabase.
State: lint, typecheck, unit tests and knowledge/shell/layout-parity e2e green locally. Branch `f508c2-knowledge-staff`, stacked on `f508c-knowledge-admin`.
Left: nothing for #226.
Decisions: none new.
