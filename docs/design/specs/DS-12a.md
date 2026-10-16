# DS-12a — Grant matches list (`/staff/grants/matches`)
Source docs: `docs/design/POLISH_PLAN.md` row DS-12a; `docs/design/fas-screen-plan-part2.md` §4 P2-1 (layout: fit score, title, funder, close date, range, eligibility flag badges, pipeline status; trust: flags as text + glyph; a11y: list items, text values); mockup `docs/design/mockups/p2-grant-matches.png` (no artboard in `targets/visual-direction.md`; its shared type steps and the eyebrow → finding sentence → picture → source line pattern apply); `docs/GRANT_MATCHING.md` (six components, caps, flags); `harness/DECISIONS.md` D-025 (weights as fractions, shown as points of 100), D-040 (the hover rule); DS-09 spec (the explain kit); `.claude/skills/design-polish/references/*`; feature list F-504 (`e2e: match-explanation.spec.ts`).
**Depends on:** DS-09 kit on main (`ExplainCard`, `Hint`, `Provenance` through `SourceFooter`); F-504 stored `match_result` rows; `pipeline_status` rows (F-503, only when staff have moved an opportunity). **Budget:** ≤ 400 hand-written lines (D-012). **Mockup:** `p2-grant-matches.png` (1440). Sub-packet **a** only; the panel redesign is DS-12b.

## Purpose and users
Staff open this page to decide which open grant to look at next. Each row must say, without a legend, how well the grant fits, when it closes, how much money it is, what could stop FAS applying, and whether anyone has picked it up. Every number explains itself on hover, focus and tap.

| Role | Gets |
|---|---|
| staff, admin | The scored list, best fit first, with the "How we matched" panel per row |
| board_viewer | 403 (unchanged) |

## Audit (before, from `docs/design/reviews/DS-12a/before/`)
### Numbers inventory
| Element | Has hover card? | Term id | Source shown? | As-of shown? | Hidden reason wired? | Action |
|---|---|---|---|---|---|---|
| Score cell (`75`) | no | — | no | header only | no (a capped 0 looks like a real 0) | `ExplainCard` tile on `fit_score`, value "N of 100 points", the cap reason as a row |
| Eligibility word (`Eligible`, `Unknown`) | no | — | no | no | no | Badge with glyph + `Hint` on the eligibility term |
| Flags (count only, `Flags: 2`) | no | — | no | no | no | one Badge per stored flag: glyph for severity + the stored message, `Hint` with the severity words |
| Closes (`Nov 5, 2027`, wraps to 3 lines) | no | — | no | no | no | "closes Nov 5, 2027" inside the meta line; "no close date" when null |
| Award range | not shown | — | — | — | — | floor–ceiling from the stored columns; "award not stated" when both null |
| Pipeline status | not shown | — | — | — | — | Badge from the stored `pipeline_status.status`, "Not tracked yet" when there is no row |
| Header `as of Oct 2026` | no | — | config id only | yes | — | `SourceFooter` under the list (Grants.gov · open opportunities · n · as of) |

### Controls under 44 px below 1024
| Control | Measured at 375 | Fix |
|---|---|---|
| none: `Button size="sm"` is already `h-11` below `lg` | 44 | keep |

### Layout
| Width | Horizontal scroll? | Notes |
|---|---|---|
| 375 | no, but the table squeezes to a 7,876 px page; close dates break to three lines; "ScoreEligibility" headers touch | list rows; the meta line wraps as prose |
| 1024 | no | "Closes" and "Score" columns are 40 px wide; the title takes 60 % of the width |
| 1440 | no | same, with a wider title column; no picture, no source line |

### States
| State | Exists? | Copy | Fix |
|---|---|---|---|
| Empty (no config) | yes | "Matching is not switched on yet" | keep |
| Empty (no rows) | yes | "No open opportunities yet" | keep |
| Loading | no `loading.tsx` | — | out of scope (DS-14 owns route skeletons); noted in Open questions |
| Error | yes | ErrorState with reference id and Try again | keep |
| Permission denied | yes | 403 | keep |

### Copy faults
| Text | Where | Replacement |
|---|---|---|
| `Flags: 2` | eligibility cell | each flag as words with a glyph |
| `v1-draft rules` | description | kept, with the words "rules" beside the id; the id is the stored config name staff cite |
| `Unknown` | eligibility cell | "Eligibility unclear" with a hint saying which facts are missing is in the panel (DS-12b); here the badge reads "Could not check" |

### Tokens and styling faults
None: the table uses tokens. The row button is `variant="outline" size="sm"` (fine).

### Mockup gaps
| Mockup element | In a? | Packet |
|---|---|---|
| Fit tile, title, funder · closes · range line, flag badges, status badge | yes | DS-12a |
| Filters (Source, Status, Closes, Sort), "Add foundation opportunity", digest-threshold count | no | later; no stored digest threshold on this page yet |
| Sticky "How we matched" panel with bars, checklist, award history, actions | no | DS-12b |
| Footer "Grants.gov refreshed …, API key used …" | partly | `SourceFooter` with the newest `computed_at`; refresh and key lines need the source registry (open question) |

### Estimate
~230 hand-written lines (terms 45 + test 25, match-query 25, MatchList 85, page 10, e2e 40). No split needed.

## Scope
- `lib/grants/terms.ts`: `FIT_SCORE`, `COMPONENT` (six keys), `CAP` (`blocker_cap`, `floor_cap`), `SEVERITY` (blocker, warning, info), `STAGE` (the seven pipeline stages plus "Not tracked yet"), `ELIGIBILITY` (eligible, not eligible, could not check, flagged), each a `Term` with a title and ≤ 2 plain sentences; `stageTerm(status)` maps a stored status (any case) to its term, falling back to a generic term whose title is the stored word.
- `lib/grants/match-query.ts`: `MatchItem` gains `award: string` (from `opportunity.award_floor` / `award_ceiling`) and `status: string | null` (from `pipeline_status.status` for this org, null when no row); `awardRange()` exported and pure. Nothing invented: both read stored columns.
- `components/grants/MatchList.tsx` (new, client): `ol > li[data-match]`; `MatchTable` is removed from `MatchPanel.tsx`? No: `MatchPanel.tsx` is DS-12b's file, so `MatchTable` stays exported there unused until b deletes it. The page imports `MatchList`.
- `app/(app)/staff/grants/matches/page.tsx`: renders `MatchList`; source footer.
- `tests/e2e/match-explanation.spec.ts`: list assertions; hover/focus/tap text; axe; scrollWidth.
- Out of scope: filters, digest threshold, panel redesign, pipeline actions, `loading.tsx`.

## Layouts
| Viewport | Row |
|---|---|
| 375 | Card, 16 px padding. Tile on top (numeral 36 px, "fit of 100" beneath), then title, meta line (wraps), badge cluster, the 44 px "How we matched" button full width |
| 1024 | Card, 24 px padding, two columns `auto 1fr`: tile left (fixed 88 px), body right; button inline at the end of the body |
| 1440 | As 1024 inside the 1200 px content width |

Reading order = visual order: tile → title → meta → badges → button → panel (when open).

## Components (existing only)
`Stack`, `Section`, `EmptyState`, `ErrorState`, `PageHeader` (layout); `Badge`, `Button` (ui); `ExplainCard`, `Hint` (explain kit); `SourceFooter` → `Provenance` (trust); `MatchPanel` (unchanged, DS-12b); lucide `Ban`, `TriangleAlert`, `CircleHelp`, `Check`, `CircleDot`.

## Exact copy
- Section heading (serif, h2): `<n> open opportunities, best fit first`; singular `1 open opportunity`.
- Tile: `<score>` then `fit of 100`. Hover card: title `Fit score`; plain `How well this grant fits FAS, from 0 to 100, added up from six parts: mission, eligibility, evidence, award size, geography and time to apply. Higher is better.`; rows Value `<score> of 100 points`, Source `Grants.gov and FAS settings`, As of `<Mon YYYY>`, and when a cap component is stored, `Why it's 0` → the stored cap reason.
- Meta line: `<funder> · closes <Mon D, YYYY> · <award>`; `no close date`; award `$50,000–$200,000` / `up to $200,000` / `from $50,000` / `award not stated` (en dash, no spaces).
- Eligibility badge: `Eligible` (check), `Not eligible` (ban), `Could not check` (question), `Flagged` (triangle, when flags exist and nothing blocks).
- Flag badges: glyph by severity + the stored message, verbatim. Hints: blocker `Something in the rules stops FAS applying as things stand, so the fit score is capped at 0.`; warning `Worth checking before you apply; it lowers the score but does not block it.`; info `A fact we needed is missing, so this check could not run. It neither raises nor lowers the score.`
- Status badge: the stage word (`New`, `Reviewing`, `Pursuing`, `Submitted`, `Awarded`, `Declined`, `Passed`); `Not tracked yet` when no row. Hints from `STAGE`.
- Button: `How we matched` (unchanged), `aria-expanded`, `aria-controls="match-<id>"`.
- Source footer: `Grants.gov · open opportunities · n <count> · as of <Mon YYYY>`.

## States
- Empty and error: unchanged (`EmptyState`, `ErrorState`).
- Capped score: the tile shows `0`; the hover card's last row says why. Never blank, never hidden.
- No pipeline row: `Not tracked yet` (muted badge). A stored status outside the seven stages shows the stored word, capitalised, with the generic stage hint.
- Panel open: one open at a time (unchanged behaviour); the panel sits under the body inside the same `li`.

## Trust rules
- Every value on a row comes from `match_result`, `opportunity` or `pipeline_status`; the list never recomputes a score.
- Flags are text + glyph, never colour alone; the stored message is shown verbatim.
- Public opportunity dates may show the day (DS-07); the as-of is month and year.
- No FAS client data on this page.

## Accessibility
- `ol` with `li[data-match]`; each title is an `h3` under the section's `h2`.
- Tile, badges and footer are the kit's `<button aria-haspopup="dialog">` triggers: 44 px below 1024, dotted underline on text triggers, hover card or tooltip on pointer and focus, dialog on Enter/tap, Escape returns focus.
- Button 44 px below 1024; `aria-expanded` / `aria-controls` on the toggle.
- axe 0 serious or critical at 375 and 1024; `scrollWidth` equals the viewport.

## Acceptance criteria → tests
| # | Criterion | Test |
|---|---|---|
| 1 | Every grants term has a title and ≤ 2 plain sentences ≤ 220 chars with no product code; the six component keys and both caps are covered; `stageTerm` maps the seven stages in any case and falls back with the stored word | `lib/grants/terms.test.ts` |
| 2 | `awardRange` renders floor–ceiling, up to, from, and "award not stated" | `lib/grants/terms.test.ts` |
| 3 | Rows are `ol > li[data-match]` best score first, each with tile, title, funder · closes · award, eligibility badge, status badge | `tests/e2e/match-explanation.spec.ts` |
| 4 | Hovering a flag badge shows the severity words; focusing the tile shows the fit-score words and, on the capped row, `Why it's 0` with the stored reason | same |
| 5 | "How we matched" toggles `aria-expanded`, one panel at a time, panel text unchanged (stored strings only) | same |
| 6 | axe 0 serious/critical and `scrollWidth` = width at 375 and 1024 | same |

## Allowed files
`lib/grants/terms.ts`, `lib/grants/terms.test.ts`, `lib/grants/match-query.ts`, `components/grants/MatchList.tsx`, `app/(app)/staff/grants/matches/page.tsx`, `tests/e2e/match-explanation.spec.ts`, `docs/design/specs/DS-12a.md`, `harness/progress.md`.

## PR split
| PR | Contents | Est. lines |
|---|---|---|
| DS-12a | terms, query fields, `MatchList`, page, e2e | ~230 |
| DS-12b | `MatchPanel` redesign; removes `MatchTable` | later |

## Decisions
- Designer defaults (not George's): the `Fit score` plain sentence; severity, stage and eligibility hint sentences; `Not tracked yet` wording; `award not stated`.

## Open questions
1. No `loading.tsx` for this route; DS-14 owns route skeletons. Add `/staff/grants/matches` to its list.
2. The mockup footer's "Grants.gov refreshed Oct 10, 6:00 AM · API key used 0 days ago" needs `source_registry` / ingest-run rows the page does not load; the footer shows the newest `computed_at` instead.
3. The digest threshold and the "above threshold" count live in `match_config.params.digest_threshold` (`lib/grants/digest.ts`); the header could cite it in a later sub-packet.
4. `MatchTable` stays in `MatchPanel.tsx` (DS-12b's file) until b removes it.

---

# DS-12b — "How we matched" panel, plain-words flags, show more (`/staff/grants/matches`)
Source docs: `docs/design/POLISH_PLAN.md` row DS-12b; `docs/design/fas-screen-plan-part2.md` §4 P2-1 (sticky right panel: score, six components with points, a bar, the reason and a source; eligibility checklist; award-history summary with "full winning applications are not public"; bars have text values); mockup `docs/design/mockups/p2-grant-matches.png`; `docs/design/targets/visual-direction.md` shared type steps (22 px serif section headline, 34 px numeral, 11–12 px source lines); the supervisor's findings from the DS-12a after shots (`docs/design/reviews/DS-12a/after/`); D-040.
**Depends on:** DS-12a merged (#219). **Budget:** ≤ 400 hand-written lines. Sub-packet **b** only.

## Audit (before: `docs/design/reviews/DS-12a/after/`)
### Numbers inventory
| Element | Has hover card? | Term id | Source shown? | As-of shown? | Hidden reason wired? | Action |
|---|---|---|---|---|---|---|
| Component line `Mission fit · 30 of 30 points · <reason>` | no | — | raw column paths (`org.program_themes, opportunity.description`) | no | — | label is an `ExplainCard` on `COMPONENT[key]` (value `x of y points`, source words, as of); bar; reason; one source chip per ref with a `Hint` in words |
| Cap component `Blocker · 0 of 0 points` | no | — | raw path | no | — | `ExplainCard` on `CAP[key]`; no bar; the stored reason as the sentence |
| Flag line `Blocker · Could not check award size: opportunity.award_floor missing` | no | — | path inside the words | no | — | `flagWords(code, message)` in plain words; the stored string moves to the hover card's `Stored reason` row |
| Flag badge in the list (same leak) | `Hint` (severity words) | severity | no | no | — | `ExplainCard` on the severity term with rows `Stored reason` and `Checked from`; badge text from `flagWords` |
| Eligibility checklist | missing | — | — | — | — | ten rows from `FLAG_CODES`: glyph + check name + words (passed / flagged words / not checked: why) |
| Award history | missing | — | — | — | — | one line only when stored `award_history` rows exist for the listing: count, middle award, "Full winning applications are not public." |
| Award range `$0–$750,000` | n/a | — | — | — | — | `awardRange` reads a 0 floor as "up to" |

### Controls under 44 px below 1024
| Control | Measured at 375 | Fix |
|---|---|---|
| none new; `Button` and the kit triggers are 44 px below `lg` | 44 | keep; the new `Show 10 more` and `Close` buttons use `Button` |

### Layout
| Width | Horizontal scroll? | Reading order = visual order? | Notes |
|---|---|---|---|
| 375 | no | yes | 69 cards ≈ 35 000 px; the panel sits inside the open card; **fix:** 10 cards at a time with `Show 10 more` |
| 1024 | no | yes | panel inline under the row, far from the fit tile it explains; **fix:** sticky aside in a second column |
| 1440 | no | yes | same |

### States
| State | Exists? | Fix |
|---|---|---|
| Empty, error, 403 | yes (DS-12a) | keep |
| Loading | no `loading.tsx` | DS-14 (unchanged) |
| Panel: no flags | `No eligibility flags` | checklist shows ten `Passed` rows instead |
| Panel: no award rows for the listing | — | the award line is omitted (never 0, never invented) |

### Copy faults
| Text | Where | Replacement |
|---|---|---|
| `Could not check award size: opportunity.award_floor missing` | badge, panel | `Award size not checked: the listing does not state an award range` |
| `org.program_themes, opportunity.description` | panel source line | chips `FAS settings · program themes`, `Grant listing · description`, each with a hint in words |
| `0 of 0 points` on a cap component | panel | the cap term title and its stored reason only |
| `$0–$750,000` | meta line | `up to $750,000` |

### Estimate
~330 hand-written lines (terms 50 + tests 15, match-query 14, `MatchPanel` 45 deleted + 100 added, `MatchList` 60, e2e 45). No split needed.

## Scope
- `lib/grants/terms.ts`: `CHECK` (ten check names in words), `flagWords(code, message)`, `sourceWords(ref)` → `{ label, plain }`, `checklist(flags)` → ten rows `{ code, label, status, words, flag? }`; `awardRange` treats a 0 floor as no floor.
- `lib/grants/match-query.ts`: `MatchItem.awards: { count, median } | null` from stored `award_history` rows on the opportunity's `assistance_listing` (one query, `summarize()` from `lib/grants/award-history.ts`); null when the listing is missing or has no rows. `assistance_listing` added to the opportunity select.
- `components/grants/MatchPanel.tsx`: rewritten (below); `MatchTable` removed (nothing imports it).
- `components/grants/MatchList.tsx`: two-column grid at ≥ 1024 with the panel in a sticky aside; inline under the row below; flag badges through `flagWords` + `ExplainCard`; `Show 10 more` with an `aria-live` count.
- `tests/e2e/match-explanation.spec.ts`: panel words, focus on open, flag words on hover, show-more, axe, scrollWidth.
- Out of scope: pipeline actions (no route yet), filters, digest threshold, `loading.tsx`.

## Layouts
| Viewport | Panel |
|---|---|
| 375–1023 | Inside the open card, under the badges, full width, 16 px padding; the `Show 10 more` button full width under the list |
| ≥ 1024 | The list area becomes `grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]`; the list in column 1, the panel an `aside` in column 2, `lg:sticky lg:top-20 lg:self-start`, 24 px padding; the source footer stays under the list |

Panel reading order: eyebrow `How we matched` → serif title (the opportunity) → numeral + `of 100 fit` → six components (label, points, bar, reason, source chips) → cap note when stored → `Eligibility checks` list → award-history line when stored → `Close`.

## Components (existing only)
`Button` (ui), `ExplainCard`, `Hint` (explain kit), `Section`, `SourceFooter`; lucide `Check`, `Ban`, `TriangleAlert`, `CircleHelp`. The bar is the `CompareBars` idiom (muted track, `bg-chart-1` fill, text values beside it, `aria-hidden` on the graphic).

## Exact copy
- Eyebrow `How we matched`; heading = the opportunity title (serif, `tabIndex={-1}`, receives focus on open).
- Score: `<score>` then `of 100 fit`; sr text `<score> of 100 points`.
- Component row: `<COMPONENT title>` · `<points> of <max> points` · the stored reason · chips. Chip text `<Where> · <field words>`; hint `From <where long>: the <field words> field.` where `opportunity` → `Grant listing` / `the grant listing as the funder published it`, `org` → `FAS settings` / `the FAS facts an admin entered in settings`, `match_config` → `Matching rules` / `the approved matching rules`, `eligibility` → `Eligibility checks` / `the ten eligibility checks`.
- Cap note: the `CAP` term title with the stored reason as its sentence.
- Checklist heading `Eligibility checks`. Rows: `<check name> · Passed` (check glyph); `<check name> · <flagWords>` (triangle or ban by severity); `<check name> · <flagWords>` for a not-checked row (question glyph). Check names: `Who may apply`, `Geography`, `Close date`, `SAM.gov registration`, `Audited financials`, `Cost share`, `Years operating`, `Award size`, `Programme themes`, `Letter of intent`.
- `flagWords`: `Could not check <what>: <field> missing` → `<What> not checked: <why>` with `why` = `the listing does not state <field words>` for `opportunity.*` (`who may apply`, `any description`, `a close date`, `whether cost share is required`, `an award range`, `a funding category`) and `FAS has not entered <field words> in settings` for `org.*` (`whether FAS is a 501(c)(3)`, `the state FAS is in`, `the SAM.gov registration status`, `the annual budget`, `the programme themes`, `whether FAS has audited financial statements`, `how many years FAS has operated`). Any other stored message is returned as stored (they are already words).
- Award line: `Past winners on this listing: <n> awards, the middle one $<median>.` then `Full winning applications are not public.` with a `Hint`: `Counted from public award records for the same Assistance Listing. The middle award means half were smaller, half larger.`
- Buttons: `Show 10 more` (`Show the last <k>` when fewer remain); live region `Showing <k> of <n>`; `Close` (returns focus to the row's `How we matched`).

## States
- Open: one panel at a time; mount moves focus to the heading; `Close` or the toggle closes and focus returns to the toggle.
- Capped score: numeral `0`, the cap note explains; components still listed with their own points.
- No award rows: the line is absent. A 0 award floor reads `up to <ceiling>`.
- All ten checks passed: ten `Passed` rows (no "No eligibility flags" sentence).

## Trust rules
Every string on the panel comes from `match_result.components`, `match_result.flags`, `opportunity` or `award_history`; the panel never recomputes a score. The stored flag string stays visible in the hover card (`Stored reason`). No actions are shown because no pipeline route exists.

## Accessibility
- The aside is `aria-labelledby` the panel heading; the heading has `tabIndex={-1}` and receives focus on open (2.4.3); `Close` returns focus to the toggle.
- Bars are `aria-hidden`; the points text is the value. Checklist status is glyph + words, never colour alone.
- Hover, focus and tap show the same words (kit triggers); 44 px below 1024.
- axe 0 serious/critical at 375 and 1024; `scrollWidth` = viewport.

## Acceptance criteria → tests
| # | Criterion | Test |
|---|---|---|
| 1 | `flagWords` turns a "Could not check … missing" flag into plain words without a column path; other messages pass through | `lib/grants/terms.test.ts` |
| 2 | `checklist` yields the ten checks with pass / flagged / unclear and words; `sourceWords` names every ref prefix without a path; `awardRange(0, x)` reads `up to` | `lib/grants/terms.test.ts` |
| 3 | Opening a row moves focus to the panel heading; the panel lists six components as `<label> · x of y points` with the stored reason and source chips in words; the capped row shows the cap note | `tests/e2e/match-explanation.spec.ts` |
| 4 | The checklist shows ten rows; the blocked row's `Who may apply` row carries the flag words; hovering a flag badge shows the `Stored reason` row | same |
| 5 | At ≥ 1024 the panel is an aside beside the list; below, it is inside the open card | same (bounding boxes) |
| 6 | `Show 10 more` renders ten cards at a time with a live `Showing k of n` count (hidden when n ≤ 10); the award line renders only from stored rows; axe 0 serious/critical; `scrollWidth` = width | `lib/grants/match-list.test.tsx` (static render, 12 rows); e2e for axe and width |

## Allowed files
`lib/grants/terms.ts`, `lib/grants/terms.test.ts`, `lib/grants/match-query.ts`, `lib/grants/match-list.test.tsx`, `components/grants/MatchPanel.tsx`, `components/grants/MatchList.tsx`, `tests/e2e/match-explanation.spec.ts`, `docs/design/specs/DS-12a.md`, `harness/progress.md`. (`app/(app)/staff/grants/matches/page.tsx` needed no change: `MatchList`'s props are unchanged.)

## Decisions
Designer defaults (not George's): the check names, the "not checked: why" sentences, the award-history wording, `Show 10 more`.

## Open questions
1. The seed's two F-504 opportunities have no `assistance_listing`, so previews never show the award line; a seeded listing with award rows would exercise it.
2. Pipeline actions (Move to Pursuing, Request strategy draft, Pass) wait for a pipeline route.
3. Filters and the digest-threshold header line remain for a later packet.
