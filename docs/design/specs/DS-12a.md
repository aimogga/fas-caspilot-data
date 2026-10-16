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
