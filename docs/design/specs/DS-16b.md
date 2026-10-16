# DS-16b — Methodology: weights as points, inputs with provenance, statistics in plain words
Source docs: `docs/design/POLISH_PLAN.md` row DS-16a/b (methodology half); `docs/design/targets/visual-direction.md` (the bar: eyebrow → serif sentence → picture → source line); `docs/design/fas-screen-plan-part2.md` §4 Methodology row; `docs/DESIGN.md` Part 2 (need score rule 1: weights stored as fractions of 1, shown as points out of 100); DS-08 (the page's copy and states); DS-09 (explain kit); DS-11a (`lib/need-map/terms.ts` indicator terms); `.claude/skills/design-polish/references/*`.
**Depends on:** DS-09 kit and DS-11a terms on main. **Budget:** ≤ 400 hand-written lines (D-012). **Before and after shots:** taken by the supervisor from production and the preview (no `/methodology` before shots exist; this shell has no Supabase, Docker or preview access).
**File note:** `docs/design/specs/DS-16.md` lives on `ds-16a-freshness` (PR #266) and is not on main, so this half is its own file. Fold into DS-16.md after both merge if the supervisor prefers one file.

## Purpose and users
The page a board member opens when someone asks "how is this county ranked?" and the page staff cite when a funder asks the same. Every weight must read as points out of 100 with what the input measures, every input must say where it came from and when, and the statistics paragraph must explain itself without the formula.

| Role | Gets |
|---|---|
| staff, admin | The page below plus the draft notice (unchanged) |
| board_viewer | The same page, read-only, eyebrow BOARD (unchanged) |

## Scope (sub-packet b; no b2 needed, estimate 300 lines)
1. **Weights as cards.** The Weights table becomes a grid of `ExplainCard`-titled cards: label (indicator in words) → numeral `30` with `of 100 points` → one plain sentence of what the input measures → source line (source · vintage · as of). The card's hover, focus and tap show the term's words plus Value `30 of 100 points`, Source `Need score version <v>, approved <Mon YYYY>`, the input's source and release, and the as-of month. The total and the mismatch sentence stay as text under the grid.
2. **Inputs table.** Columns `Input · Source and release · Status`. The input name is an `ExplainCard` on the DS-11a indicator term (`lib/need-map/terms.ts`, alias-resolved through `lib/methodology/labels.ts`); the source cell is a `Provenance` trigger (`Census SAHIE · 2023 · as of Oct 2026`, detail vintage); a never-loaded source shows `—` with a `Hint`; status is the kit `FreshnessChip` or `NotPublished`.
3. **Statistics in words.** The "How we calculate it" paragraph gets a `Hint` on z-score, statewide average, standard deviation, weight and rank, each in plain words (`lib/methodology/words.ts` `STAT_TERMS`). The formula note drops the `z_i,c` code for words. The formula block stays as the precise form, never the only place the meaning lives.
4. **Headlines and summary.** Each section gets an eyebrow (the TOC label) and a serif headline in words, data-driven where data exists (`Uninsured rate carries all 100 points in this version.`). Prose is `max-w-prose`. The version summary under the header reads `Version v2-synthetic, approved Oct 2026 · 1 input, 100 points · 26 of 29 counties scored` with the Synthetic badge now a `Hint`, visible at every width.
- Out of scope: `app/(app)/methodology/loading.tsx` (`components/status/PageSkeleton.tsx` is not on main yet; lands with #262), the DS-08b version history, `/data-freshness` (DS-16a, #266), a "why this weight" sentence (no stored rationale, see Open questions).

## Audit (filled before code)
### Critique in brief
First impression at 1024: a competent reference page that reads as a form. The H1 is right; the five section headings are bare labels ("Inputs", "Weights"); the Weights table shows `1` and `100%` where the design rule says points out of 100; nothing on the page explains itself on hover except the Current chip; the plain paragraph leans on "z-score" and "standard deviations" with no help, and the note under the formula shows `z_i,c` to the reader. Restraint passes (one accent, no decoration). Biggest opportunity: the hover layer and the weights-as-points rule.

### Numbers inventory
| Element | Has hover card? | Term id | Source shown? | As-of shown? | Hidden reason wired? | Action |
|---|---|---|---|---|---|---|
| Weight `1`, share `100%` | No | — | No | No | — | Card: `100 of 100 points`, `ExplainCard` on `ind:uninsured_rate`, value, version source, as-of |
| Weights total `1 · 100%` | No | — | — | — | — | Kept as text `Total 100 of 100 points` under the grid |
| Inputs row: source, vintage, as of | No | — | Yes | Yes | `—` unexplained | `Provenance` trigger; `—` gets a `Hint` |
| Input name | No | ind:* | — | — | — | `ExplainCard` on the DS-11a term |
| Status `Current` | Yes (chip hint) | fresh_current | — | — | — | Kept |
| Status `Not published` (plain text) | No | not_published | — | — | — | `NotPublished` (has its `Hint`) |
| Vintages list `Uninsured rate: Census SAHIE 2023 · as of Oct 2026` | No | — | Yes | Yes | — | Kept as the words outside the cards (X4); label from the term |
| `3 of 29 counties are Not published` | No | not_published | — | — | — | `Hint` with the not-published sentence |
| Synthetic data badge | No | — | — | — | — | `Hint` |
| z-score, statewide average, standard deviations, weight, rank | No | — | — | — | — | `Hint` each |

### Controls under 44 px below 1024
| Control | Measured at 375 | Fix |
|---|---|---|
| TOC links | 44 (`min-h-11`) | none |
| New triggers | 44 via kit `TRIGGER` | none; e2e measures |

### Layout
| Width | Horizontal scroll? | h1 left / content | Reading order | Notes |
|---|---|---|---|---|
| 375 | No | 16 / 343 | Yes | Cards stack; table stacks (`ResponsiveTable stack`) |
| 1024 | No | 288 / 704 | Yes | TOC column + content; cards 2-up |
| 1440 | No | 288 / 1120 | Yes | Cards 3-up |

### States present
| State | Exists? | Copy | Fix |
|---|---|---|---|
| Empty | Yes | `Need score not approved yet` | none |
| Loading | No | — | needs `PageSkeleton` (#262); not this packet |
| Error | Yes | `Couldn't load methodology` + reference + Try again | none |
| Permission denied | n/a (all roles) | — | none |

### Copy faults
| Text | Where | Replacement |
|---|---|---|
| `z_i,c is computed over counties with a published value for input i.` | formula note | `The spread for each input is measured only over counties whose source published a value.` |
| `Weight 1 · Share of total 100%` | weights table | `100 of 100 points` |
| `Inputs`, `Weights`, `Vintages and freshness` as the only heading | h2s | eyebrow + sentence |

### Tokens and styling faults
None found (classes only; `font-mono` on the formula is deliberate).

### Mockup gaps
No artboard for this route; the bar (eyebrow → serif sentence → picture → source line) is applied per section.

### Estimate
About 300 hand-written lines: `components/methodology/index.tsx` rewrite (~140), `lib/methodology/words.ts` + test (~70), `query.ts` (+6), `page.tsx` (~15), `tests/e2e/methodology.spec.ts` (~70).

## Layouts
| Width | Weights grid | Inputs table | TOC |
|---|---|---|---|
| 375 | 1 column | stacked rows with `Label:` prefixes | wrapped chips, 44 px |
| 1024 | 2 columns | table | sticky left column |
| 1440 | 3 columns | table | sticky left column |

## Components (existing only)
`PageHeader`, `Stack`, `ResponsiveTable`, `EmptyState`, `ErrorState` (layout); `ExplainCard`, `Hint`, `Provenance` (`components/trust/explain`); `FreshnessChip`, `NotPublished` (`components/trust`); `Badge`, `Alert`. Terms: `needTerm` (`lib/need-map/terms.ts`), `whyHidden` (`lib/trust/glossary.ts`).

## Exact copy
- Summary: `Version <v>, approved <Mon YYYY>` · `<n> input[s], 100 points` · `<k> of 29 counties scored` · badge `Synthetic data` with hint `Example data made for previews. The weights, scores and dates on this page are not FAS's real settings.`
- How: eyebrow `How we calculate it`, h2 `How we turn <one|N> public input[s] into one county rank`. Paragraph: `For each Utah county we turn every input into a z-score: how far that county sits from the statewide average, measured in standard deviations. We multiply each z-score by its weight, add them up, and rank counties from the highest score to the lowest. The rank is relative: a high score means higher need than other Utah counties on these inputs, not a fixed level of need.` Note: `The spread for each input is measured only over counties whose source published a value. A county missing a required input for this version is Not published and gets no rank, the same rule as the need map.`
- Hints (`STAT_TERMS`): z-score `A z-score says how far one county sits from the typical Utah county on one input, measured in standard deviations. Zero is typical; above zero is more than typical.` · statewide average `The mean of this input across the Utah counties with a published value: add the values up and divide by the count.` · standard deviation `The usual distance between a county's value and the statewide average. One step is a normal gap; two is a wide one.` · weight `How many of the 100 points an input contributes. An input with 30 points sways the score three times as much as one with 10.` · rank `Counties are placed in order from the highest score to the lowest. Rank 1 is the highest need relative to other Utah counties, not a fixed level of need.`
- Inputs: eyebrow `Inputs`, h2 `What goes into the score`. Columns `Input · Source and release · Status`.
- Weights: eyebrow `Weights`, h2 one input `<Label> carries all 100 points in this version.`; several `<Label> counts most, at <p> of 100 points.` (tie: `<A> and <B> count most, at <p> of 100 points each.`); no total `Weights are not available yet.` Card: label, `<p>` + `of 100 points`, the term's sentence, `<source> · <vintage> · as of <Mon YYYY>`. Under the grid: `Total <sum> of 100 points.` and the existing mismatch sentence.
- Vintages: eyebrow `Vintages`, h2 `When each input was published and last loaded`.
- Limits: eyebrow `Limits`, h2 `What this score cannot tell you` (unchanged).

## States
Unchanged from DS-08: approved, newer draft (staff/admin), empty, error. A weight whose share cannot be computed renders `Not published` in place of the numeral with the not-published sentence as the card's hidden reason.

## Trust rules
Every card and row carries source, vintage and as-of; the version and approval month are on the summary and in every weight card; points are rounded from stored fractions and the stored sum is still printed; nothing is invented (no rationale, no meeting dates). Synthetic badge whenever the version says so or the environment is not production.

## Accessibility
h1 → h2 per section, eyebrow is a `p` not a heading; `ExplainCard` and `Hint` triggers are 44 px below 1024 (kit); popovers are `role="dialog"` labelled by title; table keeps `caption` and `th scope`; axe 0 serious or critical at 375/1024/1440; `scrollWidth` ≤ viewport.

## Acceptance criteria → tests (`tests/e2e/methodology.spec.ts`)
| # | Criterion | Test |
|---|---|---|
| AC1 | Each weight reads `<p> of 100 points`; its card shows the same words on hover, focus and tap, with value, version source and as-of; Escape returns focus | `AC1: weight cards` |
| AC2 | Inputs table: the source cell is a `Provenance` trigger whose card names the source and vintage; the input name's card gives the indicator's plain words | `AC2: inputs provenance` |
| AC3 | The statistics paragraph has a `Hint` on each of five terms; hover text equals focus text; no term code stands alone | `AC3: statistics hints` |
| AC4 | Every section has an eyebrow and a serif h2 in words; the summary is visible at 375, 1024 and 1440; axe 0 serious/critical; `scrollWidth` ≤ viewport; triggers ≥ 44 px at 375 | `AC4: headlines, summary, axe` |
| Unit | `words.ts`: points, headline variants, no codes in `STAT_TERMS` | `lib/methodology/words.test.ts` |

## Allowed files
`components/methodology/index.tsx`, `app/(app)/methodology/page.tsx`, `lib/methodology/words.ts` (+ test), `lib/methodology/query.ts` (+ test), `tests/e2e/methodology.spec.ts`, `docs/design/specs/DS-16b.md`, `harness/progress.md`.

## PR split
One PR (`ds-16b-methodology`).

## Decisions
- Points are `Math.round(w / total × 100)`; the stored sum still prints so a mismatch is visible (DS-08 rule, DESIGN.md need score rule 1).
- Indicator words come from `lib/need-map/terms.ts`; `labels.ts` keeps the alias map and the unknown-key fallback only.
- The eyebrow repeats the TOC label so a jump target and its section read the same.

## Open questions
1. `need_score_config` has no rationale column, so "why this weight" cannot be shown; the card says what the input measures and nothing about why. Needs a schema decision (George) before any sentence appears.
2. `loading.tsx` for `/methodology` waits for `PageSkeleton` (#262). **Resolved by DS-23.**
3. The seed is single-input (`uninsured: 1`), so the multi-input headline (`counts most, at 30 of 100 points`) is covered by unit tests only until a multi-input version is approved.
