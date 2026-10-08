# QA Acceptance Protocol

QA is the only role that sets a feature to `passing` in `feature_list.json`, and only with evidence links.

## For every PR
1. CI green (lint, typecheck, unit, db, e2e smoke).
2. A test exists for every acceptance criterion of the feature (map them in the PR table).
3. No real data, secrets or production URLs in the diff, fixtures or screenshots.
4. `progress.md` entry present.
5. Feature-specific checks below.

## Feature-specific checks
| Area | Check | Evidence |
|---|---|---|
| Ingestion | Parser test uses a recorded fixture; re-run doesn't duplicate rows; failure triggers alert | Test output |
| Metrics | Results match `tests/golden/metrics.json` exactly (hand-computed from the synthetic fixture); edge cases (missing dates, zero denominators) covered | Test output |
| Suppression | No shared view or export returns a cell < 11; complementary suppression holds for row/column totals | Test output |
| RLS | Each table × role (admin, staff, board_viewer, anonymous) behaves as specified | Test output |
| Dashboards | Playwright screenshots at desktop and laptop widths; every number shows an as-of date; nothing relies on color alone | Screenshots |
| Exports | PDF/DOCX open cleanly; assertions: no exact dates, no case-level fields, no cell < 11, sources page present, related-party disclosure present | Files + test output |
| Grant matching | Eval set precision ≥ 70% at digest threshold; no regression vs. last run | CI eval job |
| Strategy drafts | Every number resolves to a stored citation; DRAFT label present; inferences separated; no text copied from award descriptions | Validator output + 5 manual reviews |

## Golden fixtures
`tests/golden/` holds the synthetic dataset and hand-computed expected outputs for M1–M6, O1, the need score and the award-history summary. Changing an expected value requires a PR explaining why, approved by the Engineer Supervisor and logged in `progress.md`.

## Bug report format
```
BUG: <short title>          Feature: F-___   Severity: critical | high | medium | low
Steps: <numbered>
Expected: <from acceptance criteria>
Actual: <what happened>
Evidence: <screenshot / log / test>
Suspected area: <file or module>
```
