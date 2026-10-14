# Grant match eval rubric (F-509)

`labels.json` is a **synthetic** labeled set: public-opportunity shapes (Grants.gov v1 `summary` fields and foundation rows), invented agencies, titles and numbers, no FAS client data. Real labels from FAS grant staff replace it (George-gated). `as_of` is the fixed "today" every run uses, so close-date checks never drift.

Each entry carries `label` (`good` = a FAS grant writer would spend time on it, `poor` = they would not), a one-line `why`, and `eligible_expected` (`true`, `false` or `"unknown"`), which is what `checkEligibility().eligible` should return.

## Labeling rules (apply in order)
1. **Hard stop → poor, `eligible_expected: false`.** Wrong applicant type (state, county, city, tribal or university only), already closed as of `as_of`, restricted to another state, or a minimum-years / audit requirement FAS cannot meet.
2. **Off mission → poor.** Nothing in the text or funding categories touches FAS's themes (therapy, mental health, family preservation, court-involved families, social services), or the theme word appears but the funded activity is something FAS does not run (inpatient beds, research trials, construction).
3. **Not worth the effort → poor.** Award ceiling under $10,000; award floor above half of FAS's annual budget; a match or cost share above roughly 25%; fewer than 7 days to close.
4. **On mission, open, feasible → good.** Utah, regional or national programs that fund therapy or related family services for nonprofits, with no rule 1–3 problem. A 10% match, a letter of intent, outcomes or wait-time reporting, or 2–3 weeks to close do not by themselves make it poor.
5. **Sparse data does not change the label.** Label on what a writer would do after reading the entry; set `eligible_expected: "unknown"` when a check cannot run (missing close date, award range, applicant types or cost-share field).
6. **Balance and honesty.** Keep roughly 40% good / 60% poor, include hard negatives (right theme, wrong applicant; Utah but closed; national with heavy match) and never relabel to make the scorer pass. If the scorer disagrees with a label, the miss goes in the golden and the weights get tuned in their own PR.

## Gate
`lib/grants/eval.test.ts` runs under `pnpm test`: precision floor (measured, see the TODO in the test), recall ≥ 0.50, eligibility accuracy ≥ 0.90, and `misses` equal to `tests/golden/match-eval.json`. `pnpm eval:grants` prints the same report locally; `--write-golden` regenerates the golden on purpose.
