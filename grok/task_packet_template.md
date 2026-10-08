# Task Packet Template (every handoff uses this)

Copy the block, fill every field, and attach it to the handoff. Packets live in GitHub Issues (label `packet`) so Cursor Cloud Agents and every bot can read them.

```yaml
packet_id: TP-0000                 # sequential
feature_id: F-000                  # from harness/feature_list.json (exactly one)
title: ""
from: chief-of-staff | engineer-supervisor | deep-research | qa | nightly-audit
to: engineer-bot | qa | deep-research | engineer-supervisor | george
phase: 0
goal: ""                           # one sentence, outcome not activity
context_files:                     # read these before starting, in this order
  - AGENTS.md
  - harness/progress.md            # last 3 entries
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
human_gate: none | george-before-merge | george-before-deploy | george-before-send
max_diff_lines: 400
plugins_allowed: []                # only items marked "Use" in harness/PLUGIN_INVENTORY.md
done_means:
  - PR open with template filled
  - CI green
  - progress.md entry added
  - QA packet created for feature_id
escalate_if:
  - tests fail after 2 honest attempts
  - a decision is needed that is not in docs/ or harness/DECISIONS.md
  - any privacy rule would be bent
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
