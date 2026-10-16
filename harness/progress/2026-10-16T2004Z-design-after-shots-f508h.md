## 2026-10-16 01:55 (UTC) — Claude Code (cloud, Engineer) — F-508h after shots from the PR preview (design)
Did: `pnpm shots --id F-508h --tag after` against the #263 preview at `6e79d94`: open draft as staff at 375 (full page), 1024 and 1440, each with a focus variant showing a citation chip's explain card; approved draft as admin at 1024 and 1440. 8 PNGs plus manifest rows in `docs/design/reviews/F-508h/`. The drafts are synthetic rows in fas-dev (stack migrations F-508e and F-508g applied there ahead of merge, with George's OK).
State: binary and manifest only. Branch `design/after-shots-f508h`, stacked on `f508h-application-editor`.
Left: nothing for the shots. fas-dev migration history was repaired the same day: `f508e_strategy_draft` and `f508g_application_draft` now sit at their file versions (`20261016000000`, `20261016010000`) with the full SQL stored. `20261015190000_f207_ut_courts_terms` (main, #203) is still not applied to fas-dev.
Decisions: none new.
