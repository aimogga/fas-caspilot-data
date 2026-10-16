# DS-13a — Board dashboard: quarter in words, three KPIs in a rule row, "Data as of", Letter print
Source docs: `docs/design/targets/visual-direction.md` (Board, the approved target look); `docs/design/POLISH_PLAN.md` row DS-13a; `docs/design/fas-screen-plan-part2.md` §4 P1-2 (board dashboard, print-friendly); mockup `docs/design/mockups/p1-board-dashboard.png` (secondary); `.claude/skills/design-polish/references/*` (bar, plain language, audit, evidence); DS-07 (metric card copy and states); DS-09 (explain kit); DS-10a (KPI card precedent).
**Depends on:** DS-09 explain kit on main. **Budget:** ≤ 400 hand-written lines (D-012). **Before shots:** PR #214 (`docs/design/reviews/DS-13a/before/board-{375,1024,1440}.png`, `board-816-print.png`). **After shots:** taken by the supervisor from the preview (`--print --pdf`).

## Purpose and users
The one screen a board member reads before a meeting, on screen or on paper. It must answer "how did families fare, how do we know, when" in the first viewport, in words that survive being read aloud, with every number explaining itself on hover, focus and tap.

| Role | Gets |
|---|---|
| board_viewer | `/board`: the quarter in words, three KPIs, the pictures, the cards, print to Letter |
| staff, admin | The same page from the Board nav group (George, 2026-10-15) |

## Scope (sub-packet a only)
- `quarterWords(period)` → `July–September 2026` (en dash), appended to the end of `lib/dashboard/format.ts` (shared file; nothing else touched there).
- Eyebrow `Family Advocacy Services · Board summary`; H1 `How families fared, July–September 2026` on screen and in print; the privacy rule as the header line: `County totals only. Anything under 11 families is hidden.`
- "Data as of" block (`dl`): Data as of `<Mon YYYY>` (an `ExplainCard` on `as_of`), Period `<quarter words>, the latest complete quarter`, Counties `All counties, county totals only`.
- `components/board/KpiRow.tsx`: three KPIs in one rule row (1 px rules, no cards): M1 median wait, M4 finished therapy (`65 of 92 who closed` from the stored total), M5 cost per completed course. Each: label as an `ExplainCard` trigger → 36 px tabular numeral with sr text → what it counts → comparison in words with a `Hint` naming the prior quarter → `SourceFooter` (Provenance).
- `components/board/print.css`: `@page { size: letter; margin: 16mm }`, hover, popover and tooltip faces hidden, explain triggers printed as plain text, 11 pt body, 22 pt serif H1, KPI row three across, one ink (black on white as before).
- Out of scope (DS-13b): sections in words ("Did families improve?" …), the sources paragraph, page numbers, the packet card, replacing the seven metric cards with sections.

## Audit (filled before code; before shots PR #214)
### Numbers inventory
| Element | Has hover card? | Term id | Source shown? | As-of shown? | Hidden reason wired? | Action |
|---|---|---|---|---|---|---|
| Header `Jul–Sep 2026 (Q3) · All counties · Data as of Sep 2026` | No | as_of | — | Yes | — | "Data as of" `dl` with an `ExplainCard` on the date; period in words |
| Summary paragraph numbers | No (prose) | — | in text | at end | in words | Kept (DS-13b trims it into sections) |
| Picture cards | Yes (ChartFrame + Provenance) | m4/m6/o1 | Yes | Yes | hatch + note | Kept |
| Seven metric cards | Yes (Info button + Provenance) | m1–o1 | Yes | Yes | Yes | Kept below the row (DS-13b replaces them with sections) |
| No first-glance numbers | — | — | — | — | — | New KPI row: M1, M4, M5 with cards on the label and a hint on the comparison |
| M4 card total `33 of 38` | Table only | m4 | Yes | Yes | Yes | Worded `33 of 38 who closed` under the 87% numeral |
| Delta `↑ $30 higher than Q2` | No | delta | — | — | — | Comparison line `↑ $30 higher than April–June 2026` with a `Hint` |

### Controls under 44 px below 1024
| Control | Measured | Fix |
|---|---|---|
| Print, Download Word, Download CSV | 44 (actions slot) | none |
| ExplainCard / Hint triggers | 44 via kit `TRIGGER` | none (e2e measures at 375) |

### Layout
| Width | Horizontal scroll? | h1 left / content | Reading order | Notes |
|---|---|---|---|---|
| 375 | No | 16 / 343 | Yes | H1 wraps to two lines; actions stack; a 7-sentence paragraph before any number |
| 1024 | No | 288 / 704 | Yes | H1 "How FAS help is working" says nothing about the quarter; no number above the fold |
| 1440 | No | 288 / 1120 | Yes | Same; the page opens with prose, not a finding |

### States present
| State | Exists? | Copy | Fix |
|---|---|---|---|
| Empty | Partly | cards "Not available yet" | KPI "Not available yet" + why; n = 0 in words |
| Loading | n/a (server render) | — | — |
| Error | Yes (page `ErrorState`) | "Couldn't load the board dashboard" | per-KPI `ErrorState` on a failed view |
| Permission denied | n/a (all roles) | — | — |
| Print | Yes | 16 mm margins, black on white | Letter size, faces hidden, KPI row three across, serif 22 pt H1 |

### Copy faults
| Text | Where | Replacement |
|---|---|---|
| `Jul–Sep 2026 (Q3)` | header | `July–September 2026` |
| `BOARD` | eyebrow | `Family Advocacy Services · Board summary` |
| `How FAS help is working` | H1 | `How families fared, July–September 2026` |
| `No closed cases this quarter` | M1 card (kept) | KPI row words: `No court-ordered case reached a first session this quarter` |

### Tokens and styling faults
| Finding | File:line | Fix |
|---|---|---|
| `#fff` / `#000` | print.css (one-ink rule, pre-existing) | kept: print is deliberately one ink; no new hex added except the rule colour on the KPI row |

### Mockup gaps (artboard → page)
| Artboard element | In this sub-packet? | Packet |
|---|---|---|
| Eyebrow, serif H1 with the quarter, privacy sentence | Yes (packet wording) | a |
| "Data as of" block, 3-KPI rule row (screen plan P1-2) | Yes | a |
| Four numbered picture cards with finding sentences | No | b |
| Sections in words, sources paragraph, page numbers | No | b |
| Packet card (generated date, page count, next meeting) | No | b; needs a stored packet record |

### Estimate
~215 added, ~15 deleted ≈ 230 hand-written lines (markdown excluded). One PR.

## Layouts (signed in, DS-02 shell)
| Viewport | h1 left | Content width | KPI row |
|---|---|---|---|
| 375 | 16 | 343 | stacked, horizontal rules between |
| 1024 | 288 | 704 | three across, vertical rules |
| 1440 | 288 | 1120 | three across |
| Print (Letter) | 16 mm | sheet | three across, black rules |

Order at every width: eyebrow → H1 → privacy line → actions → Data as of → summary paragraph → KPI row → pictures → "The numbers behind the pictures" cards → freshness → note.

## Components (existing only)
`PageHeader`, `Stack`, `Grid`, `ErrorState` (layout); `ExplainCard`, `Hint` (explain kit); `SourceFooter`, `SuppressedCell` (trust); `Pictures`, `MetricCard`, `FreshnessWidget`, `PrintButton`. No new tokens, no globals edits.

## Exact copy
- Eyebrow: `Family Advocacy Services · Board summary`. H1: `How families fared, <quarter words>`. Line: `County totals only. Anything under 11 families is hidden.`
- Data as of: `Data as of` · `<Mon YYYY>` or `Not available yet`; `Period` · `<quarter words>, the latest complete quarter`; `Counties` · `All counties, county totals only`.
- KPI labels: `Wait for a first session` · `Finished therapy` · `Cost per completed course`. The explain card title is the metric's `METRIC_CARDS` name.
- Detail lines: `Median of <n> families: half waited less, half waited more` · `<completed> of <closed> who closed` · `Average across <n> completed courses`.
- Comparison: `↓ 4 days faster than April–June 2026` · `↑ 3 points higher than April–June 2026` · `Same as April–June 2026` · `Nothing to compare with April–June 2026`. Hint: `April–June 2026 is the quarter before this one. Lower is better for this number.` (M1) / `… Higher is better for this number.` (M4) / `… The dollar figure is an average, so one costly course can move it.` (M5) / `… There is no number to compare with: too few families then, or no data.`
- States: `Not available yet` + `This number appears once the data behind it is set up.`; `No court-ordered case reached a first session this quarter`; `No closed cases this quarter`; `No course of therapy was completed this quarter`; `Couldn't load this number` + `Try again`; hatch `— n<11` with the kit hint.

## States
Value · suppressed (1 ≤ n < 11, hatch) · no-data (n = 0, words) · not-available (no metrics) · error (failed view). The hatch never stands in for a zero or a failure.

## Trust rules
Every KPI comes from `MetricsQuery` (same suppression as the dashboards). Counts appear only when n ≥ 11. Quarter and month dates only. Source · period · n · as of on every KPI. Comparison carries an arrow and words. Nothing invented: no page count, no meeting date, no example numbers.

## Accessibility
Row is a `section` named "Three numbers for the quarter"; numerals carry sr text with unit and quarter; the "Data as of" block is a real `dl`; every trigger is a 44 px kit button below 1024 with the visible focus ring; hover text = focus text = tap text (e2e); Escape closes; print hides every face so a reader never sees a stray card. axe 0 serious/critical at 375 and 1024; `scrollWidth` ≤ 375.

## Acceptance criteria → tests
| # | Criterion | Test |
|---|---|---|
| 1 | `quarterWords` names the quarter in months with an en dash | `lib/board/kpis.test.ts` |
| 2 | Three KPIs word stored values: median wait with comparison, `x of y who closed`, cost; hints name the prior quarter | `kpis.test.ts`, `tests/e2e/board-dashboard.spec.ts` |
| 3 | States: error / not available / n = 0 words / hatch only 1 ≤ n < 11; never a zero | `kpis.test.ts` |
| 4 | Eyebrow, H1 with the quarter, privacy line, Data-as-of `dl`, KPI row before the pictures | `board-dashboard.spec.ts` |
| 5 | Label hover text equals focus text; 44 px triggers at 375; axe 0 serious/critical; no overflow | `board-dashboard.spec.ts` |
| 6 | Print: Letter, 22 pt serif H1, 11 pt body, KPI row three across, faces hidden, shell hidden, black ink | `board-dashboard.spec.ts` |

## Allowed files
`app/(app)/board/page.tsx`, `components/board/KpiRow.tsx` (new), `components/board/print.css`, `lib/board/kpis.ts` (new), `lib/board/kpis.test.ts` (new), `lib/dashboard/format.ts` (append `quarterWords` only), `tests/e2e/board-dashboard.spec.ts`, `docs/design/specs/DS-13a.md`, `harness/progress.md`.

## PR split
One PR (sub-packet a). DS-13b follows on its own branch.

## Decisions
- The seven metric cards stay below the KPI row this packet (DS-13b replaces them with sections); M1, M4 and M5 therefore appear twice until then. `visual.spec.ts` pins seven cards and is not in this packet's files.
- The eyebrow and H1 follow the packet wording, not the artboard's "This quarter in four pictures"; the artboard's privacy sentence is used as the header line.
- The "Data as of" date keeps the `Mon YYYY` form used by every footer so the page says one date one way.
- `#000` for the KPI row rules in print follows the file's existing one-ink rule; no new token.

## Open questions
1. In the synthetic seed, M1 has no court-ordered first session in the latest quarter, so the first KPI reads "No court-ordered case reached a first session this quarter" on previews; a value appears once the seed carries Q3 first sessions.
2. The summary paragraph still runs seven sentences before the row; DS-13b decides whether it becomes the one-sentence lead the target asks for.
3. No stored packet record, next-meeting date or page count exists, so the artboard's packet card is left for DS-13b and ships without those fields.

---

# DS-13b — Board dashboard: four sections in words, sources paragraph, page footer, actions row, packet card
Source docs: as DS-13a, plus the DS-13a after shots (`docs/design/reviews/DS-13a/after/`, branch `design/after-shots-ds-13a`) and the supervisor's findings from them. **Depends on:** DS-13a (#246) on main. **Budget:** ≤ 400 hand-written lines (D-012). **Before shots:** `docs/design/reviews/DS-13a/after/`. **After shots:** taken by the supervisor from the preview (`--print --pdf`).

## Purpose and users
Same page, same readers. After DS-13a the first viewport is right; the rest of the page still read as a dashboard (seven cards with codes, a freshness widget with source ids, a seven-sentence paragraph). DS-13b turns the body into four numbered sections a board member can read top to bottom, on screen or on paper, each opening with a sentence, and ends with one sources paragraph.

## Scope (sub-packet b only)
- `lib/board/sections.ts`: the four sections in reading order, each with its number, question, finding sentence (from `lib/board/summary.ts`), supporting sentence and picture ids; `LEAD`, the one-sentence lead that replaces the paragraph.
- `lib/board/counties.ts`: "Need in the counties we serve" from `NeedMapQuery.load` (read only; the need-map code is owned by #248): FAS service counties with their statewide rank and signed score, the finding and support sentences, the column sources and as-of.
- `lib/board/sources.ts`: the sources paragraph built from the same n and as-of as the footers; the privacy rule in words.
- `components/board/Sections.tsx`: eyebrow `1 · Did families improve?` → serif finding (`h2`) → supporting sentence → pictures (the existing `BarChart` / `LineChart` in a card, their own caption stepped down to sans so each section has one serif headline) → source line → View as table; section 4 is a real table under an `ExplainLayer` with a rank cell per county and "Open the county need map"; `PacketCard` with no invented date or page count.
- `components/board/Sources.tsx`: `Sources.` paragraph with the FAS clause as a `Provenance` trigger; the running print footer.
- `app/(app)/board/page.tsx`: actions row under the header (H1 keeps the full row at 1024); need data loaded beside the metrics; seven metric cards, `Pictures`, freshness widget and note removed.
- `components/board/print.css`: `@page` bottom margin and `@bottom-center` page counter, fixed footer fallback, sections unbreakable, 15 pt serif section headlines, packet card and map link hidden.
- Out of scope: a stored packet record (none exists), the county map picture on the board (the need map stays on `/need-map`), "Who FAS served" by county (no county counts in `DashboardMetrics`).

## Audit (from the DS-13a after shots)
### Numbers inventory
| Element | Has hover card? | Term id | Source shown? | As-of shown? | Hidden reason wired? | Action |
|---|---|---|---|---|---|---|
| Summary paragraph (7 sentences) | No | — | in text | at end | in words | Replaced by `LEAD`; the sentences open their sections |
| Picture cards (3) | Caption only | — | Yes | Yes | hatch + note | Kept inside sections 1–3 with their footers and View as table |
| Seven metric cards | Yes | m1–o1 | Yes | Yes | Yes | Removed: the KPI row and sections carry the same numbers with words |
| Freshness widget rows `cdc-places`, `hrsa-hpsa-mh`, `propublica_990`, `va-vetpop`, `Latest —` | No | — | ids only | No | No | Removed from the board; the sources paragraph names the public sources used in words |
| County need (new) | Yes (`ExplainLayer`, term `rank`) | rank | Yes (Census names + vintage) | Yes | `not_published` / `not_available` | Section 4 table and sentences |
| Sources paragraph (new) | Yes (`Provenance` on the FAS clause) | source:FAS records | Yes | Yes | words | Foot of the page and the print sheet |

### Controls under 44 px below 1024
| Control | Measured | Fix |
|---|---|---|
| Print, Download Word, Download CSV (outside the header now) | `min-h-11` on each; `[&_button]:min-h-11` on the row | measured in e2e (Print ≥ 44 at every width) |
| Rank cells | `min-h-11` below `lg` | — |
| View as table, Open the county need map | `h-11 lg:h-8` / `min-h-11` via `buttonVariants` | — |

### Layout
| Width | Horizontal scroll? | Notes |
|---|---|---|
| 375 | No | Eyebrow → H1 → privacy line → actions stacked → Data as of → lead → KPI row → sections (one column) → packet card → sources |
| 1024 | No | **Fault:** H1 "How families fared, July–September 2026" wrapped into a four-line column beside the three buttons (header grid `minmax(0,1fr) auto`). Fix: actions on their own row under the header |
| 1440 | No | Same as 1024 with wider pictures (two across in section 1) |
| Print | — | Sections never split; packet card, map link and buttons hidden; footer fixed at the sheet bottom; `@bottom-center` page counter where supported |

### States present
| State | Exists? | Copy | Fix |
|---|---|---|---|
| Not available (no metrics) | Partly | cards | Section finding `Not available yet` + `This number appears once the data behind it is set up.`; county section `County need is not available yet.` |
| Error (failed view) | per card | — | Section `ErrorState` "Couldn't load this section" with reference id and Try again |
| n = 0 / hidden | words | summary sentences | Kept as the section finding (`No court-ordered case reached a first session this quarter.`) |
| No FAS counties | No | — | `No service counties are recorded yet.` |
| Packet record | No | — | `A saved packet for <quarter> is not available yet.` with a `Hint`; never a date or page count |

### Copy faults
| Text | Where | Replacement |
|---|---|---|
| `cdc-places`, `hrsa-hpsa-mh`, `propublica_990`, `va-vetpop`, `Latest —` | freshness widget | removed from the board |
| `The numbers behind the pictures` + card titles with codes | h2 + cards | four questions in words |
| `Counts under 11 are hidden … FAS Evidence.` | note | sources paragraph: `Counts under 11 families are hidden to protect privacy, and a neighbouring value is hidden when a small count could be worked out from a total. Dates are shown by quarter.` |

### Tokens and styling faults
| Finding | File:line | Fix |
|---|---|---|
| `#000` rules | print.css | kept: the file's one-ink rule |

### Mockup gaps (artboard → page)
| Artboard element | In this sub-packet? | Packet |
|---|---|---|
| Four numbered picture cards with finding sentences | Yes (sections with rules, pictures in cards) | b |
| 1 Where need is highest (county map) | Table of FAS counties + "Open the county need map" | b; the map picture stays on `/need-map` |
| 2 Who FAS served (counts by county) | No: no county counts in `DashboardMetrics` | later; needs a county series |
| 3 How fast families got help (five-quarter line with a goal line) | Line from the existing trend when M1 has n > 0; no goal line (no stored goal) | b |
| 4 Where the money went (share bar + rates) | Share bar; rates in the finding sentence | b |
| Packet card with generated date, page count, next meeting | Words only, nothing invented | needs a stored packet record |
| Page numbers | `@bottom-center` counter + fixed footer fallback | b |

### Estimate
~313 added, ~64 deleted ≈ 377 hand-written lines (markdown excluded). One PR.

## Layouts
| Viewport | Sections | Pictures |
|---|---|---|
| 375 | one column, 32 px between, top rule each | one per row |
| 1024 / 1440 | one column, 72ch sentences | section 1 two across; others full width |
| Print | unbreakable, 15 pt serif headline, black rules | two across in section 1 |

Order at every width: eyebrow → H1 → privacy line → actions row → Data as of → lead → KPI row → 1 Did families improve? → 2 How long families waited → 3 Where our therapy dollars went → 4 Need in the counties we serve → packet card → sources (→ print footer).

## Components (existing only)
`PageHeader`, `Cluster`, `Stack`, `Grid`, `ErrorState`; `ExplainCard`, `Hint`, `Provenance`, `ExplainLayer`; `SourceFooter`; `BarChart`, `LineChart`, `Card`; `KpiRow`, `PrintButton`. No new tokens, no globals edits.

## Exact copy
- Lead: `Four pictures tell the quarter: whether families improved, how long they waited, where the therapy dollars went and where need is greatest in the counties we serve.`
- Eyebrows: `1 · Did families improve?` · `2 · How long families waited` · `3 · Where our therapy dollars went` · `4 · Need in the counties we serve`.
- Findings: the `summary.ts` sentences for M4, M1, M6; support: O1, M2, M5. County: `<County> has the highest need of the N counties we serve, ranked 4th of 26 statewide.` / `None of the N counties we serve has a published need score.`; support `K of N rank among the 10 highest-need counties in Utah; H not published. Relative ranking, not absolute need.`
- County table: `County` · `Rank statewide` · `Need score`; `Not published` and `—` for an unscored county; source line `Public sources · Census SAHIE 2024, … · n = N counties · as of Oct 2026`; link `Open the county need map`.
- Packet card: eyebrow `Board packet`; `A saved packet for July–September 2026 is not available yet.`; `Packets are not stored yet, so there is no generated date or page count to show. Print this page or download the files above for today's numbers.`
- Sources: `Sources. FAS records for July–September 2026, as of Sep 2026: first sessions after a court order (n = 17), funding decisions (n = 19), approved families (n = 19), closed cases (n = 38), completed courses of therapy (n = 33), therapy episodes (n = 38), follow-up scores (n = 21). County need: Census SAHIE 2024, …, need score version v1, as of Oct 2026. Counts under 11 families are hidden to protect privacy, and a neighbouring value is hidden when a small count could be worked out from a total. Dates are shown by quarter.`
- Print footer: `FAS Evidence · Board summary · July–September 2026 · County totals only`.

## States
Section: value · not-available · error (reference id + Try again). County: value · not-available · no-counties; a county row: Ranked · Not published · Not available yet. Hidden metric values stay worded "fewer than 11" in the finding and hatched in the pictures.

## Trust rules
Every sentence comes from `summary.ts` over the suppressed `DashboardMetrics`, or from `NeedMapQuery` ranks; nothing is estimated. No goal line, no county counts, no packet date or page count, no meeting date. Related party: section 3's finding names providers affiliated with FAS and both hourly rates when shown.

## Accessibility
Each section is a `section` labelled by its `h2`; the county table has a caption, `th scope` on columns and rows, one focusable rank cell per row with the same words on hover, focus, Enter (dialog) and Escape; the lead and findings are ≤ 72ch; buttons are verb-first; print hides every control and face; the running footer is 9 pt (print only). axe 0 serious/critical at 375 and 1024; `scrollWidth` ≤ 375.

## Acceptance criteria → tests
| # | Criterion | Test |
|---|---|---|
| 1 | Four sections in order, each opening with its summary sentence; error / not-available states; no picture listed for either | `lib/board/sections.test.ts`, `tests/e2e/board-dashboard.spec.ts` |
| 2 | County section words stored ranks; unscored county reads Not published; not-available and no-counties states | `lib/board/counties.test.ts`, e2e (rank hover = focus words, map link) |
| 3 | Sources paragraph from the same n and as-of as the footers, skipping failed views, no codes | `lib/board/sections.test.ts`, e2e |
| 4 | H1 keeps the full row at 1024 (≤ 2 lines); actions on their own row; lead replaces the paragraph; no metric cards or freshness widget | e2e |
| 5 | Packet card never shows a date or page count | e2e |
| 6 | Print: four sections unbreakable, sources paragraph and fixed footer printed, packet card / map link / View as table hidden | e2e (print emulation) |

## Allowed files
`app/(app)/board/page.tsx`, `components/board/Sections.tsx` (new), `components/board/Sources.tsx` (new), `components/board/Pictures.tsx` (removed), `components/board/print.css`, `lib/board/{counties,sections,sources}.ts` (new) + tests, `tests/e2e/board-dashboard.spec.ts`, `tests/e2e/visual.spec.ts` (board test selectors only), `docs/design/specs/DS-13a.md`, `harness/progress.md`.

## Decisions
- Sections are rule-separated regions, not cards (the KPI row set that pattern in DS-13a); the pictures inside keep their cards so the chart kit is reused unchanged.
- The chart caption inside a section is stepped down to sans and muted with a page-local class so each section has one serif headline (bar H2); `ChartFrame` is not edited.
- Section 4 is a table rather than a map: the map and its hover layer are owned by #248; the table equals the map's own table view and links to it.
- `[data-slot=actions]` moves out of `PageHeader` (globals.css is kit-only); the row is a `Cluster` with `min-h-11` on each control so the DS-13a 44 px check still passes at 1440.
- The packet card prints nothing (it only says what does not exist yet) and the running footer carries the title instead of a page number in Chromium.
- `Pictures.tsx` is deleted; `lib/board/pictures.ts` stays (the evidence packet uses it).

## Open questions
1. No stored packet record, next-meeting date or page count exists; the packet card words that and the artboard's "Download PDF / See earlier packets" wait for a packet table.
2. "Who FAS served" (counts by county) needs a county series in `DashboardMetrics`; not on the board until then.
3. The M1 goal line ("Goal 21 days") needs a stored target; the wait picture draws no goal.
4. Chromium prints no page number (`@page` margin boxes unsupported); the fixed footer repeats the title on every sheet. A PDF generator with margin-box support would print "Page n of N" from the same rule.
5. In the seed M1 has n = 0 in the latest quarter, so section 2 opens with the n = 0 words and no line picture on previews.
