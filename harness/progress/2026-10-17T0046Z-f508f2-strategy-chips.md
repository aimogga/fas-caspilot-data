## 2026-10-17 (UTC) — Claude Code (cloud, Engineer) — F-508f follow-up: chip words for every citation kind
Did: `lib/strategy/view.ts` `KIND` gains plain-words chips for `recipient_profile` ("Past winner", Form 990), `award_abstract` ("Award summary") and `org_knowledge` ("FAS fact"). Before this they fell back to the generic "Source". New unit test: every registered resolver kind has its own chip word.
State: lint, typecheck, unit tests and `pnpm gate` green. Branch `f508f2-strategy-chips` off main.
Left: approver names in the strategy footer still read "you" / "an admin" (no user-names table yet).
Decisions: none new.
