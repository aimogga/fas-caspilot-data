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
