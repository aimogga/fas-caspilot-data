# DS-11a — County need map: explain layer, table and panel in words
Source docs: `docs/design/POLISH_PLAN.md` row DS-11a; `docs/design/targets/visual-direction.md` (County need map section: the serif question H1, one plain sentence, source lines in words); `docs/design/mockups/p1-county-map.png` (secondary); `docs/design/fas-screen-plan-part2.md` §4 P1-4; `harness/DECISIONS.md` D-040 (the hover rule); `.claude/skills/design-polish/references/polish-bar.md` rows H2, P1, P3, X1–X5, G2, A2–A4; `plain-language.md` (approved wording, core term table); `docs/DESIGN.md` Part 2 need-map rules 2, 5, 6, 8; DS-06 (map explorer), DS-09 (explain kit).
**Depends on:** DS-09 (`ExplainBody`, `ExplainCard`, `Hint`, `Provenance`, `lib/trust/glossary.ts`), DS-06 (`NeedTable`, `CountyPanel`, `CompareBars`, `NeedMapQuery`). **Budget:** ≤ 400 hand-written lines (D-012). **Sub-packet b** (map hover card, hover stroke, rank labels, legend hints) is a separate PR on `NeedMap.tsx`, `MapSelect.tsx`, `MapHover.tsx`.

## Purpose and users
The need map is the first page a board member opens and the one with the most raw numbers (29 rows × 13+ columns, each with a source code and a release year). Today none of those numbers explains itself: "Bin (placeholder)", "+1.40", "9.2% ± 0.5" and "Not published" sit bare in cells. This packet gives every cell, header, rank, score, band, badge and indicator one plain-words card on hover, focus and tap (D-040), without adding one Radix root per cell.

| Reader | Gets |
|---|---|
| Board member | A question as the headline, one sentence of what the page does, and a card on any number that says what it is, where it comes from, when, and why it is hidden |
| Staff between calls | The same, plus the source and release year in the Provenance dialog on every panel footer |
| Keyboard and screen-reader users | Arrow keys walk the cells; Enter pins a `role="dialog"`; Escape closes and returns focus; a polite live region reads the same sentence |

## Audit (page-audit-template, before code)
- Mockup: `docs/design/targets/visual-direction.md` need-map section (target); `p1-county-map.png` secondary. Screen plan §4 P1-4. Existing spec DS-06. Code: `app/(app)/need-map/page.tsx`, `components/need-map/{NeedTable,CountyPanel,CompareBars,NeedMap,MapSelect}.tsx`, `lib/need-map/*`. Before shots: PR #214 `docs/design/reviews/DS-11a/before/need-map-{375,1024,1440}.png`.

### Numbers inventory
| Element | Has hover card? | Term id | Source shown? | As-of shown? | Hidden reason wired? | Action |
|---|---|---|---|---|---|---|
| Table `Rank` cells (`1 of 26`) | no | `rank` | no | no | no ("Not published" bare) | `data-term` → `ExplainLayer` |
| Table `Need score` cells (`+1.40`) | no | `need_score` | no | no | no | same |
| Table `Bin (placeholder)` cells (`5 of 5`) | no | `placeholder_bins` | no | no | no | same; header reads "Band (placeholder)" |
| Table indicator cells (`9.2% ± 0.5`, `95,000 people`) | no | `ind:<code>` | header note only | no | no | same; value carries "margin of error ± x" in words |
| Table `Status` cells | no | `status` (new) | — | — | — | same |
| FAS county badge (table) | no | `fas_county` | no | — | — | `data-term` on the badge |
| Column headers | no | `rank`, `need_score`, `placeholder_bins`, `ind:<code>`, `status` | note | no | — | `ExplainCard` text trigger |
| Panel rank line (`Rank 4 of 26 · Need score +1.10`) | no | `rank`, `need_score` | version line below | no | — | two `ExplainCard`s |
| Panel indicator label and value | no | `ind:<code>` | footer | footer | sentence below | `ExplainCard` on the label; `Hint` on `± x` |
| Panel footer (`Census SAHIE · 2024 · as of Oct 2026`) | no | `source:<name>` | yes | yes | — | `Provenance` |
| Compare bars median tick | native `title` only | — | — | — | — | `Hint` on the "State median" legend item; `title` dropped |
| Map counties, legend | no | — | — | — | — | **DS-11b** |
| Page footer (`Public sources: … · Placeholder bins`) | no | — | yes | yes | — | left as is (explained by the legend and headers; DS-11b may wrap it) |

### Controls under 44 px below 1024
| Control | Measured size at 375 | Fix |
|---|---|---|
| County name links in the table | ~22 px tall | unchanged (existing DS-06 control; noted in Open questions) |
| Table cells (new reading targets) | ~38 px row height | not Tab stops; reached by arrow keys and tap; noted in Open questions |
| New `ExplainCard`/`Hint` triggers | 44 px via the kit's `min-h-11 min-w-11` | — |

### Layout
| Width | Horizontal scroll? | h1 left / content width | Reading order = visual order? | Notes |
|---|---|---|---|---|
| 375 | no (`layout-parity` 16 / 343) | 16 / 343 | yes | Full-page shot is 48 663 px tall: the stacked table repeats every column label for 29 rows. Out of scope here (a "Ranked list" view is the target's answer; see Open questions) |
| 1024 | no | 288 / 704 | yes | Header note wraps mid-column ("Child poverty rate", "Court filings …") |
| 1440 | no | 288 / 1120 | yes | — |

### States present
| State | Exists? | Copy | Fix |
|---|---|---|---|
| Empty | yes | "No public data loaded yet", "Need score not computed yet", "No FAS counties set" | — |
| Loading | no skeleton (server-rendered, `force-dynamic`) | — | not in this packet |
| Error | yes | "Couldn't load the need map" + reference id + Try again | — |
| Permission denied | n/a (all roles) | — | — |

### Accessibility (manual, pre-change)
| Finding | Impact | Fix |
|---|---|---|
| Median tick carries a native `title` inside an `aria-hidden` span: pointer-only words | moderate | `Hint` on a visible legend item |
| Compare-bars legend item is `aria-hidden`, so the words "State median" are pointer-only | minor | remove `aria-hidden`, keep the tick glyph hidden |
| No keyboard path to a cell's explanation (none exists) | serious under D-040 | `ExplainLayer`: arrows walk `[data-term]` cells, Enter pins, Escape closes, live region |

### Copy faults
| Text | Where | Replacement |
|---|---|---|
| "Bin (placeholder)" | table header, stacked cell label | "Band (placeholder)" + card "Placeholder bands" |
| "County need map" / "Relative need across Utah's 29 counties, from public data. Select a county…" | H1, description | "Where is the need greatest?" / "Each county is ranked against the other 28 on public measures such as poverty and uninsured rates. Darker means more need. Pick a county to see why it ranks where it does." |
| "± 0.5" bare | panel value, table cell | `Hint` "Margin of error ± 0.5. The true value is likely within this much of the number shown, either way."; table card value "9.2% (margin of error ± 0.5)" |
| "Not published" bare in rank/score/bin/indicator cells | table | card row "Why it's hidden: The source did not publish this for this county in that release." |

### Tokens and styling faults
| Finding | File:line | Fix |
|---|---|---|
| none new; `CompareBars` keeps inline `style` for bar widths (dynamic, allowed as in `LineHover`) | — | — |

### Mockup gaps (target doc)
| Target element | In this sub-packet? | Packet |
|---|---|---|
| Serif question H1 + one sentence | yes | DS-11a |
| View switch Map · Ranked list · Table; "Show" chip row; "Rank out of 26 scored · 3 not published" caption | no | later (needs a view model; Open question) |
| County name + "#rank" on the map; legend in words (Lower need · Below average · Above average · Highest · Not published) | no | DS-11b (`NeedMap.tsx`) |
| Source line under the map with weights approval month and vintages | no | DS-11b |
| Panel: population in words, "4th highest need of 26 counties scored", "Higher need on 3 of 4 measures" | partly (rank line explains itself; the comparison sentence exists) | population is not stored (Open question) |
| Panel bars with verdict + source per measure | partly (bars, words, median hint) | per-bar source line later |
| "Add to packet" | no | out of scope (no route) |

### Estimate
Hand-written lines ≈ 330 (terms 55, layer helpers 30, layer component 60, table 25/15, panel 20/10, bars 6/4, page 4/2, tests 110). One sub-packet.

## Scope
- `lib/need-map/terms.ts` (new, pure): `NEED_TERMS` (`status`, `ind:<code>` for the 15 indicator codes the query names), `needTerm(id, label?)` (need-map term → core glossary → fallback titled with the column label), `splitMoe`, `moeWords`, `scoreCell`, `indicatorCell`, `FAS_BADGE` (the data attributes a cell carries).
- `lib/trust/layer.ts` (new, pure): `cardPosition` (under the target, inside the layer's width, above when it would run off the bottom), `liveText`, `nextTarget`.
- `components/trust/explain-layer.tsx` (new, client): one positioned `ExplainBody` card for every descendant with `data-term` (+ `data-value`, `data-source`, `data-asof`, `data-hidden`). `pointerover` shows, `pointerleave` hides, `focusin` shows, click or Enter/Space pins (`role="dialog"` labelled by the title), Escape closes and returns focus when pinned, Arrow/Home/End walk the targets, `aria-live="polite"` reads `liveText`. Terms resolve through a `terms` prop, then `term()` from the core glossary.
- `NeedTable`: wrapped in `ExplainLayer`; headers are `ExplainCard` text triggers; every cell carries its data attributes and `tabIndex={-1}`; the FAS badge carries `fas_county`; the region gets an `aria-describedby` key hint; "Bin" → "Band".
- `CountyPanel`: rank and score are `ExplainCard`s; each indicator label is an `ExplainCard` with value, source + release and as-of; `± x` is a `Hint`; footers are `Provenance` (source · period = release year · as of).
- `CompareBars`: the median legend item is visible to assistive tech and carries a `Hint`; the tick's native `title` is gone.
- `page.tsx`: H1 "Where is the need greatest?" and the one-sentence description.
- Out of scope: everything on the map SVG and legend (DS-11b), the view switch and "Show" chips, population and "n-th highest" sentences, per-bar source lines, "Add to packet", a stacked-table redesign at 375.

## Layouts
Unchanged from DS-06 (`layout-parity.spec.ts` rows for `/need-map` stay green): 375 → 16 / 343; 800 → 80 / 696; 1024 → 288 / 704; 1440 → 288 / 1120. The layer card is `absolute` inside the table wrapper (`relative`), 20 rem wide, clamped to the wrapper's width, so `scrollWidth` never grows. Hover faces from the kit are portaled with `collisionPadding` 8.

## Components (existing only)
`ExplainBody`, `ExplainCard`, `Hint`, `Provenance` (DS-09); `ResponsiveTable`, `PageHeader`, `Badge`, `Card*`; `asOfNote`; `term`, `whyHidden` (`lib/trust/glossary.ts`). New: `ExplainLayer` (kit; listed in the DS-09 table as "DS-11a onward").

## Exact copy
- H1: `Where is the need greatest?` · Description: `Each county is ranked against the other 28 on public measures such as poverty and uninsured rates. Darker means more need. Pick a county to see why it ranks where it does.` (The target's "four public measures" is not used: the columns come from whatever sources have loaded.)
- Headers: `County` · `Rank` · `Need score` · `Band (placeholder)` · `<indicator label>` + note `<source> <release>` · `Status`.
- `status`: "Ranked means this county has a need score in the current version. Not published means the score could not be built because an input is missing for this county."
- Indicator terms (`ind:*`), e.g. `uninsured_rate`: "The share of people under 65 in this county with no health insurance, from the latest Census estimate. A higher share means more families who may struggle to pay for care." Unknown code: "A public measure for this county. The source and release year are in the column note; the footer says when we last loaded it."
- Margin of error: `Margin of error ± <x>. The true value is likely within this much of the number shown, either way.` Card value: `9.2% (margin of error ± 0.5)`.
- Median: "The middle Utah county for this measure: half the counties are above this line, half below. One extreme county cannot move it much."
- Keys hint (sr-only): "Arrow keys move through the numbers and read what each one means; Enter keeps the explanation open and Escape closes it."
- Hidden reasons from `whyHidden`: not_published, not_available. Score cells' source: `Need score version <v>`. Panel footer text unchanged: `<source> · <release> · as of <Mon YYYY>`.

## States
- No active target: no card in the DOM; live region empty (SSR markup is the table plus an empty `aria-live` span).
- Hover or focus: card without a role, `pointer-events-none`, under the target.
- Pinned: `role="dialog"`, `aria-labelledby` the title, `data-pinned="true"`; stays while the pointer moves; Escape, a click elsewhere or Enter on the same cell closes it.
- Hidden cell: the card's last row is "Why it's hidden"; the cell still reads "Not published" / "Not available yet"; never 0, never blank.
- Panel as-of missing: `Provenance` reads "date not available yet" (through `asOfNote`); the footer fallback is `Not available yet`, not "Not published".

## Trust rules
- Every word in a card also exists outside it: the cell text, the header note (`<source> <release>`), the panel footer, the "did not publish" sentence, the compare-bars words.
- Nothing is invented: card rows come from the row's own `cells`, `columns[].note` and `sources[].asOf`; the measure count is not stated; population and "n-th highest" wait for stored data.
- Public indicators only (no FAS counts), county level, month or year dates.
- No source code reaches a user without words: the terms test bans SAHIE, SAIPE, ACS, MOE, FIPS, pct in plain text (the source names stay in the footer by design, as "Census SAHIE").

## Accessibility
- One card, many targets: cells are `tabIndex={-1}` (not Tab stops), walked by Arrow, Home and End from the focusable region; the region's `aria-describedby` says so. The county link stays the row's Tab stop.
- Pinned card is a non-modal `role="dialog"` named by its title; focus stays on the cell; Escape returns focus to the cell. The live region reads title · value · source · as-of · reason.
- Kit triggers: 44 px below 1024, dotted underline, 2 px `--ring` focus; cells get a 2 px inset ring on `:focus-visible`.
- Median legend item no longer `aria-hidden`; the tick glyph still is.
- axe 0 serious or critical with the pinned card open at 1024 and 375 (e2e).

## Acceptance criteria → tests
| # | Criterion | Test |
|---|---|---|
| 1 | Every need-map term has a title, ≤ 2 plain sentences ≤ 220 chars, no source code; `needTerm` falls back to the glossary and then to the column label | `lib/need-map/terms.test.ts` |
| 2 | `splitMoe`/`moeWords`; `scoreCell`/`indicatorCell` carry term, value (with margin in words), source, as-of and a hidden reason only when hidden | `lib/need-map/terms.test.ts` |
| 3 | `cardPosition` keeps the card inside the layer and flips above at the bottom; `liveText` reads only present parts; `nextTarget` walks from either end | `lib/trust/layer.test.tsx` |
| 4 | `ExplainLayer` SSR: children, no card, empty polite live region | `lib/trust/layer.test.tsx` |
| 5 | Table: region inside the layer; header `ExplainCard`s; every cell has `data-term` + attributes; Not published cells carry the reason; the FAS badge carries `fas_county` | `lib/need-map/need-map.test.ts` |
| 6 | Panel: rank/score `ExplainCard`s; indicator footers are `Provenance` triggers with unchanged text; `± x` has one `Hint` | `lib/need-map/county-panel.test.ts`, `need-map-svg.test.ts` |
| 7 | Hover, focus and Enter show the same words on a cell; Enter pins `role="dialog"` named "Rank"; Escape closes and refocuses; ArrowRight walks; Not published and FAS badge explain; header hover card; panel Provenance dialog lists Period; median hint; `scrollWidth` = width and axe 0 serious/critical with the dialog open at 1024 and 375 | `tests/e2e/map.spec.ts` "explain layer" |
| 8 | H1 reads "Where is the need greatest?" for every role | `tests/e2e/map.spec.ts` (existing loop) |
| 9 | Hand-written diff ≤ 400, no code line > 300 chars, progress entry last | `pnpm gate` |

## Allowed files
`lib/need-map/terms.ts`, `terms.test.ts`, `county-panel.test.ts`, `need-map.test.ts`, `need-map-svg.test.ts`; `lib/trust/layer.ts`, `layer.test.tsx`; `components/trust/explain-layer.tsx`; `components/need-map/NeedTable.tsx`, `CountyPanel.tsx`, `CompareBars.tsx`; `app/(app)/need-map/page.tsx`; `tests/e2e/map.spec.ts`; `docs/design/specs/DS-11a.md`; `harness/progress.md`. Never: `app/globals.css`, `components/trust/index.tsx`, `components/trust/explain.tsx`, `harness/generated-files.json`, `NeedMap.tsx`, `MapSelect.tsx`, `components/staff/**`, `lib/staff/**`, `tests/e2e/home.spec.ts`, `tests/e2e/visual.spec.ts`.

## PR split
One PR (`ds-11a-need-map`). DS-11b follows on its own branch after this merges.

## Decisions
1. Cells are reading targets, not controls: `tabIndex={-1}` keeps 29 × 17 cells out of the Tab order; arrows walk them from the region (the `LineHover` precedent). The county link remains the row's control.
2. The layer card is positioned inside the table wrapper rather than portaled: it scrolls with the page, never widens it, and needs no Radix root per cell (X5).
3. `Provenance` is used for the panel footer with `n=""` (public indicators have no family count; the empty row is dropped by `ExplainBody`). The margin of error is a `Hint` on the `± x` itself, because `Provenance` has no free rows and the margin belongs beside the number.
4. Indicator terms live in `lib/need-map/terms.ts` keyed `ind:<indicator_code>` so unknown codes (the preview shows court-filing columns) still get a card titled with their label.
5. The description does not count the measures; the target's "four" is an artboard example.

## Open questions
1. **Stacked table at 375** is 48 000 px tall (every column label repeats per row). The target's "Ranked list" view (name, rank, score, band) would replace it on small screens; needs a view switch (DS-11c or a later row in the plan).
2. **Population and "4th highest need of 26 counties scored"** need `total_population` to be loaded as an indicator for every county and an ordinal helper; not wired here, nothing invented.
3. **Cells below 44 px**: rows are ~38 px at 375. They are not controls, but a tap opens the card. If QA wants 44 px, `py-3` on stacked cells costs ~1 line and ~6 px per row.
4. **Page footer** (`Public sources: … · Placeholder bins`) is still plain text; wrap in `Provenance` with the need-score version when DS-11b touches the legend.
5. **DS-09 open question 1 (one `HATCH`)** still stands; not touched.
