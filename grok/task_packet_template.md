# Task Packet Template (every handoff uses this)

Copy the block, fill every field, and attach it to the handoff. Packets live in GitHub Issues (label `packet`) so Cursor Cloud Agents and every bot can read them.

```yaml
packet_id: TP-0000                 # sequential
feature_id: F-000                  # from harness/feature_list.json (exactly one)
title: ""
from: chief-of-staff | engineer-supervisor | deep-research | qa | nightly-audit
to: engineer-bot | qa | deep-research | engineer-supervisor | george
route: Cursor                      # Copilot | Cursor (harness/COPILOT_ROUTING.md)
phase: 0
goal: ""                           # one sentence, outcome not activity
context_files:                     # read these before starting, in this order
  - AGENTS.md
  - harness/progress/              # 3 newest files (D-041)
  - docs/PRD.md#<section>
inputs: ""                         # data, fixtures, prior PRs
acceptance_criteria:               # copied from feature_list.json, never weakened
  - ""
tests_required:
  - ""                             # e.g. unit: metrics/m1.test.ts; e2e: upload.spec.ts
out_of_scope:
  - ""
data_allowed: synthetic-only       # synthetic-only | public-only | prod-aggregate (George approval)
environments_allowed: local, preview   # never prod unless human_gate says so
risk_level: low | medium | high
human_gate: none                   # none | george. Default none (D-013). george only for real FAS data, outbound email, acceptance-criteria changes, money/plan (D-014)
max_diff_lines: 400                # hand-written lines only; lockfiles + generated files don't count but must be listed by name in the PR body (D-012)
plugins_allowed: []                # only items marked "Use" in harness/PLUGIN_INVENTORY.md
done_means:
  - PR open with template filled
  - CI green
  - harness/progress/ entry file added
  - QA packet created for feature_id
escalate_if:
  - tests fail after 2 honest attempts
  - a decision is needed that is not in docs/ or harness/DECISIONS.md
  - any privacy rule would be bent
```

## Copilot issue body (route: Copilot)

Copilot can't read packet threads, so the issue must carry everything.
Inline the spec, the AC and the line cap; don't just link them.

```markdown
Route: Copilot
Packet: TP-0000 · Feature: F-000

## Goal
One sentence.

## Spec
- docs/design/specs/<ID>.md#<section>
- (quote the relevant spec lines here)

## Acceptance criteria (copied, never weakened)
1. ...
2. ...

## Tests required
- unit: ...
- e2e: ... (scoped locators; no presence-only assertions)

## Files allowed
- path/one.tsx
- path/two.test.ts

## Limits
- Hand-written diff ≤ 400 lines, added plus deleted (D-012).
- One statement per line; no line packing.
- Synthetic data only; no secrets.
- Do not touch (George-gated):
  - `.github/workflows/` (CI, secret scan, nightly audit, staleness check)
  - The main ruleset or any repo settings
  - Auth and sessions: `middleware.ts`, `lib/supabase/`, login/session code
  - `supabase/migrations/` and RLS policies
  - `n8n/`
  - `harness/DECISIONS.md`, statuses in `harness/feature_list.json`
  - Acceptance-criteria edits
  - Money, plan or billing changes
  - Email in George's name
  - Real FAS data
- If one of those is needed, stop; don't work around it and don't decide it in the PR.
- Say so in the PR; the Engineer Supervisor takes it to George through Chief of staff.

## Out of scope
- ...
```

## Return report (what the receiver sends back)

```yaml
packet_id: TP-0000
status: done | blocked | needs-decision
pr_url: ""
evidence:                          # links: CI run, screenshots, test output
  - ""
what_changed: ""                   # 3 lines max
what_i_did_not_do: ""              # be explicit
open_questions: []
next_suggested_packet: ""
```
