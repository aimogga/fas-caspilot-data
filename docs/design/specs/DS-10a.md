# DS-10a — Staff and admin home: dated greeting, three KPI cards, public sources two-up
Source docs: `docs/design/targets/visual-direction.md` (Staff home, the approved target look); `docs/design/POLISH_PLAN.md` row DS-10a; `docs/design/fas-screen-plan-part2.md` §4 P0-2; mockup `docs/design/mockups/p0-staff-home.png` (secondary); `.claude/skills/design-polish/references/*` (bar, plain language, audit, evidence); DS-07 (metric card copy and states); DS-09 (explain kit).
**Depends on:** DS-09 explain kit on main (#212). **Budget:** ≤ 400 hand-written lines (D-012). **Before shots:** PR #214 (`docs/design/reviews/DS-10a/before/staff-{375,1024,1440}.png`).

## Purpose and users
The first screen a staff member or admin sees. It should answer "what happened this quarter, how do we know, when" in one glance, in words a case manager between calls can read aloud, and send them to the thing they came to do.

| Role | Gets |
|---|---|
| staff | `/staff`: greeting, quarter sentence, three KPI cards, public sources, quick links; actions Enter a case · Upload data |
| admin | `/admin`: the same component with admin actions (Open data freshness · Open team dashboard) and admin quick links |
| board_viewer | 403 (unchanged) |

## Scope (sub-packet a only)
- Eyebrow: weekday and date in America/Denver ("THURSDAY, OCTOBER 15"), uppercase via the existing eyebrow style.
- Greeting as the H1: "Good morning / afternoon / evening" by Denver hour (before 12 · before 17 · after), with ", <first name>" only when `user_metadata.full_name` (or `name`) is set. The seed has none, so previews read "Good afternoon".
- One serif summary sentence in words, built from stored numbers only (`lib/staff/home.ts` `summary`). Never an example number.
- Three KPI cards: M1 wait, M2 decision, M4 completion (all bands rate). Each: label (the metric title as an `ExplainCard` trigger), direction chip in words with a `Hint`, 44 px tabular numeral with unit, sparkline where a four-quarter series exists (M1, M2), `SourceFooter` (Provenance card).
- Direction chip: `Better · 4 days faster`, `Worse · 1 day slower`, `Same as last quarter`; glyph ↓/↑/→ plus the word, never colour alone. Hint text names the quarter compared and which direction is better.
- Failed-load fix: a tile whose view failed shows `ErrorState` ("Couldn't load this number", reference id, Try again); no data at all shows "Not available yet"; n = 0 shows "No closed cases this quarter" / "Not enough closed episodes"; only 1 ≤ n < 11 shows the hatch. The hatch never stands in for a failure or a zero.
- Two-up row: "Public sources" card (rows worst first from `FreshnessPage`, status in words with the `FreshnessChip` hint, "Open data freshness" link) beside the role's quick-links card.
- Out of scope (DS-10b): the to-do list, the second summary sentence ("Two things need you before Friday"), the families-by-month chart, sparkline hover via `LineHover`.

## Audit (filled before code; before shots PR #214)
### Numbers inventory
| Element | Has hover card? | Term id | Source shown? | As-of shown? | Hidden reason wired? | Action |
|---|---|---|---|---|---|---|
| Tile title (h2) | No | m1/m2/m3/m5 | — | — | — | `ExplainCard` on the title with value, source, as-of, hidden reason |
| Big numeral | No | — | footer | footer | — | Title card covers it; numeral gets `aria` text with unit and period |
| `— n<11` hatch | Yes (kit) | suppressed | — | — | Partly: shown for n = 0 and for a failed load too | Split states: error / not-available / no-data / suppressed |
| Delta line "↑ $30 higher than Q2" | No | delta | — | — | — | Becomes the direction chip with a `Hint` naming the quarter and the better direction |
| Sparkline "Better/Worse" word | role=img label | — | — | — | — | Kept (DS-10b adds hover) |
| Source footer | Yes (Provenance) | source | Yes | Yes | — | Keep |
| Header "Data as of Sep 2026" | No | as_of | — | Yes | — | Replaced by the dated eyebrow; as-of stays on every card footer |

### Controls under 44 px below 1024
| Control | Measured | Fix |
|---|---|---|
| Quick-link buttons | 44 (outline button) | none |
| ExplainCard / Hint triggers | 44 via kit `TRIGGER` | none |

### Layout
| Width | Horizontal scroll? | h1 left / content | Reading order | Notes |
|---|---|---|---|---|
| 375 | No | 16 / 343 | Yes | Four stacked tiles push the links below two screens; three cards and the two-up row shorten it |
| 1024 | No | 288 / 704 | Yes | Four tiles at `lg:grid-cols-4` are 160 px wide: titles wrap to two lines, numerals crowd |
| 1440 | No | 288 / 1120 | Yes | No greeting, no actions, no sources; the page reads as a form, not a home |

### States present
| State | Exists? | Copy | Fix |
|---|---|---|---|
| Empty | Partly | header "This quarter's numbers are not available yet." | per-card "Not available yet" + note; summary sentence says the same |
| Loading | n/a (server render) | — | — |
| Error | Wrong | failed view renders the hatch | `ErrorState` per card; whole load failure → not-available cards |
| Permission denied | Yes | 403 | — |

### Copy faults
| Text | Where | Replacement |
|---|---|---|
| "— n<11" for n = 0 | M1 tile | "No closed cases this quarter" |
| "↑ $30 higher than Q2" bare | M5 tile | chip "Worse · $30 higher" + hint "… than Apr–Jun 2026 (Q2). Lower is better for this number." (M5 leaves the home in this packet) |
| "What do you need to do?" | links h2 | kept (staff); admin "Where to look" kept |

### Tokens and styling faults
| Finding | File:line | Fix |
|---|---|---|
| `text-[2rem]` numeral | HomeTiles.tsx:15 | `text-4xl` (36 px, within 32–40) with `tabular-nums` |
| `style={{ color: tone }}` | Sparkline.tsx | DS-10b (chart file is owned by b) |

### Mockup gaps (artboard → page)
| Artboard element | In this sub-packet? | Packet |
|---|---|---|
| Dated eyebrow, serif greeting, summary sentence, two actions | Yes | a |
| Three KPI cards with direction chips, 44 px numerals, source line | Yes | a |
| "Needs you · N items" list | No | b |
| "Families helped, by month" chart | No | b (needs a monthly series; no field yet) |
| Public sources card with status in words and "Open data freshness" | Yes | a |
| Top bar "Public data updated 2 days ago" | Already shipped | DS-05b |

### Estimate
~250 added, ~130 deleted ≈ 380 hand-written lines (markdown excluded). Fits one PR; no further split.

## Layouts (signed in, DS-02 shell)
| Viewport | h1 left | Content width | Cards | Two-up |
|---|---|---|---|---|
| 375 | 16 | 343 | 1 column | stacked |
| 1024 | 288 | 704 | 3 columns | 2 columns |
| 1440 | 288 | 1120 | 3 columns | 2 columns |

Order at every width: eyebrow → H1 greeting → actions → summary sentence → KPI grid → Public sources · Quick links.

## Components (existing only)
`PageHeader`, `Stack`, `Grid`, `ErrorState` (layout); `ExplainCard`, `Hint` (explain kit); `SourceFooter`, `SuppressedCell`, `FreshnessChip` (trust); `Sparkline`; `Card*`, `Badge`, `buttonVariants`. No new tokens, no globals edits.

## Exact copy
- Eyebrow: `<Weekday>, <Month> <day>` in America/Denver.
- H1: `Good morning` | `Good afternoon` | `Good evening`, then `, <First>` when a full name exists.
- Actions (staff): `Enter a case` (outline, `/staff/entry`), `Upload data` (primary, `/staff/intake`). Admin: `Open data freshness` (outline), `Open team dashboard` (primary).
- Summary sentence (serif, one of):
  - `Families are getting help faster than last quarter.` (M1 delta ↓)
  - `Families are waiting longer for a first session than last quarter.` (M1 delta ↑)
  - `Families waited about as long for a first session as last quarter.` (no change)
  - `Families waited <23 days> for a first session this quarter.` (value, no comparison)
  - `Too few families this quarter to show how long they waited.` (suppressed)
  - `This quarter's numbers are not available yet.` (nothing loaded)
- KPI titles come from `METRIC_CARDS` so the glossary term matches: `Days from court order to first session` · `Days from application to funding decision` · `Completion rate by income band`. The ExplainCard on the title says what the number means, its source, as-of and why it is hidden.
- Chip: `Better · 4 days faster` · `Worse · 1 day slower` · `Same as last quarter`. Hint: `<delta words> than <Quarter label>. Lower is better for this number.` / `Higher is better for this number.`
- States: `Not available yet` + `This number appears once the data behind it is set up.`; `No closed cases this quarter`; `Not enough closed episodes`; `Couldn't load this number` + `Try again`.
- Public sources card: h2 `Public sources`; row `<name>` · chip word (`Current` / `Stale` / `Failed` / `Not published`) · `Latest <vintage>`; footer `Source registry · as of <Mon D, YYYY>`; link `Open data freshness`; empty `No sources registered yet`; failed load `Not available yet`.
- Quick links h2: staff `What do you need to do?`, admin `Where to look`.

## Trust rules
Counts under 11 hatch with the words; n = 0 and failures never hatch. Quarter and month dates only on FAS numbers; public-source run dates may show a day. Every card: source · period · n · as of. Direction chips carry a glyph and a word. All numbers from `MetricsQuery` (same suppression as the dashboards).

## Accessibility
H1 is the greeting; each KPI card is a `section` labelled by its h2; numerals have sr text with unit and period; every chip and title is a 44 px kit trigger below 1024; sparkline keeps `role="img"`; links 44 px; axe 0 serious/critical at 375 and 1024; `scrollWidth` ≤ 375.

## Acceptance criteria → tests
| # | Criterion | Test |
|---|---|---|
| 1 | Eyebrow is weekday + date in Denver; H1 greets by Denver hour; first name only with a full name | `lib/staff/home.test.ts` (`dateEyebrow`, `greeting`, `firstName`); `tests/e2e/home.spec.ts` |
| 2 | Summary sentence follows M1 state (faster / slower / same / value / hidden / none) | `home.test.ts` (`summary`) |
| 3 | Three cards M1, M2, M4 with ExplainCard titles, chips with Hint, footers | `home.test.ts` (`cards`), `home.spec.ts` |
| 4 | Failed view → error state; null data → not available; n = 0 → no-data words; 1–10 → hatch | `home.test.ts` (`cards` states), `home.spec.ts` (`data-state` never `suppressed` with n = 0) |
| 5 | Public sources card lists rows worst first with status words and the freshness link | `home.spec.ts` |
| 6 | No overflow at 375; axe 0 serious/critical; 44 px controls | `home.spec.ts`, `visual.spec.ts` |

## Allowed files
`components/staff/HomePage.tsx`, `components/staff/HomeTiles.tsx`, `lib/staff/home.ts`, `lib/staff/home.test.ts`, `app/(app)/staff/page.tsx`, `app/(app)/admin/page.tsx`, `lib/dashboard/metrics-query.ts` (one line: M4 prior-quarter delta from the all-bands rate, unused by the dashboard table card), `tests/e2e/home.spec.ts` (new), `tests/e2e/visual.spec.ts` (home test only), `docs/design/specs/DS-10a.md`, `harness/progress.md`.

## PR split
One PR (sub-packet a). DS-10b follows on its own branch.

## Decisions
- M4 on the home is the all-bands completion rate; its chip compares with the prior quarter in points (`pts` delta unit already in `format.ts`).
- The sparkline stays on M1 and M2 (existing component; DS-10b adds hover). M4 has no four-quarter series yet, so no sparkline.

## Open questions
1. No profile table or `full_name` in the seed: previews show "Good afternoon" with no name. A real deployment needs `user_metadata.full_name` set at invite time (F-605).
2. No monthly "families helped" series exists; the artboard chart waits for DS-10b and a data field.
3. M4 has no four-quarter trend in `MetricsQuery.trends`; the sparkline is left off that card rather than invented.
