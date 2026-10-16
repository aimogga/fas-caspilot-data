## 2026-10-16 22:25 (UTC) — Cloud Agent (Engineer) — F-508b2 follow-up: import checks the source line (F-508)
Did: `scripts/knowledge-import.mjs` runs each entry's `source` (or the file's `source_document` it falls back to) through `checkKnowledgeText` before any write, the QA follow-up on #250. A hit fails the whole file as `refused <key>: source:<rule>` (e.g. `source:phone`), never echoing text; a blank source is still left to `needs_source`. One unit test. Checked fas-dev (counts only, no text read): `20261016021500` is applied and all 43 `org_knowledge` rows (38 approved, 5 draft) already carry unique `import_key`s, so the duplicate-row risk flagged on #250 no longer applies.
State: lint, typecheck, unit tests and gate green. Branch `f508b2-knowledge-import`, restarted from `main` after #250 merged.
Left: nothing.
Decisions: none new.
