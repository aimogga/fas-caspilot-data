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

---

# DS-10b — Staff and admin home: "Needs you" list, public sources in words, summary before the actions
Source docs: `docs/design/targets/visual-direction.md` (Staff home §3 "Needs you", §4 Public sources); `docs/design/POLISH_PLAN.md` row DS-10b; the supervisor's findings from the DS-10a after shots (`docs/design/reviews/DS-10a/after/`); `.claude/skills/design-polish/references/*`; DS-10a above; DS-12a (`stageTerm`, pipeline stages).
**Depends on:** DS-10a merged (#215). **Budget:** ≤ 400 hand-written lines (D-012). **Before shots:** `docs/design/reviews/DS-10a/after/staff-{375,1024,1440}[-hover].png` (the DS-10a result is the "before" of this packet).

## Purpose and users
The home should tell a case manager what needs a person this week, name the public sources in words she can say aloud, and read in the artboard's order on a phone: greeting, sentence, then the two buttons.

## Scope (sub-packet b only)
1. `lib/staff/todo.ts` (pure, tested) + `components/staff/TodoList.tsx`: one "Needs you" card between the KPI grid and the two-up row. Rows only from stored tables: `upload_batch` (rows with `rows_error > 0`, or `status` not `committed` / `rolled_back` / `ok`), `pipeline_status` × `opportunity` (stage New / Reviewing / Pursuing with `close_date` within 30 days), `m3_never_started` (approved more than 60 days ago, no session in the window, reason `unknown`; the count goes through `suppressCount`). Three rows per kind at most; the family row is one row.
2. Public sources card: registry codes become words (`sourceName`), `Latest —` becomes `No load yet` or `Latest <vintage>`, both with a `Hint`; the row is a two-column grid so the badge never wraps under the name.
3. The summary sentence is the `PageHeader` description, so at 375 it sits under the greeting and above the buttons; at ≥ 768 the header grid keeps the buttons on the right (`PageHeader.description` widens from `string` to `ReactNode`, one line).
4. Not done: sparkline hover. `LineHover` is positioned for the 192 px dashboard plot (`absolute left-12 right-20 top-0 h-48`), so it does not fit beside a 120 × 32 sparkline without changing a chart file DS-15a also touches; the four-point series keeps its `role="img"` summary. Listed in Open questions.
5. Not done: "Families helped, by month" chart (no monthly series field; DS-10a open question 2 stands).

## Audit (from the DS-10a after shots)
| Finding | Where | Fix |
|---|---|---|
| `cdc-places`, `hrsa-hpsa-mh`, `propublica_990`, `va-vetpop`, `census-acs` shown to users | Public sources rows | `sourceName` map in `lib/staff/home.ts`; unknown codes stay as stored |
| `Latest —` with no explanation | Public sources rows | `No load yet` + `Hint`; `Latest 2024` + `Hint` |
| Badge wraps to a second line when the name is long (1024, `propublica_990`) | Public sources rows | `grid-cols-[minmax(0,1fr)_auto]`, badge spans both rows |
| Summary sentence below the two buttons at 375 | Header | sentence as the header description |
| No "Needs you" list; the home does not say what to do | Between KPI grid and two-up | `TodoList` |
| Controls under 44 px below 1024 | — | none: `Hint` triggers are 44 px by the kit; links are outline buttons |

## Layouts
| Viewport | Needs you | Row |
|---|---|---|
| 375 | full width; badge + title/sub-line in two columns, the link on its own line below (`col-span-2`) | stacked |
| 1024 / 1440 | full width; badge · title/sub-line · link in three columns | three columns |

Order at every width: eyebrow → H1 greeting → summary sentence → actions (right column from 768) → KPI grid → Needs you → Public sources · Quick links.

## Components (existing only)
`PageHeader`, `Stack`, `Grid`; `Hint` (explain kit); `FreshnessChip`; `Card*`, `Badge`, `buttonVariants`. No new tokens, no globals edits.

## Exact copy
- h2 `Needs you`, then ` · N items` (`1 item`) when there are rows. N is the number of rows, never a family count.
- Badges and hints: `Fix rows` — "Rows in this upload failed the checks, so they are not counted anywhere yet." · `Unfinished` — "This upload was started but never committed, so none of its rows are counted." · `Due today` / `Due tomorrow` / `Due in N days` — "Closes Mon D, YYYY. Stage in the grant pipeline: <Stage>." · `Missing` — "Therapy was approved more than 60 days ago, no first session is recorded, and no reason is on file."
- Titles: `4 rows failed checks in the therapy episodes upload` · `The cases upload was never finished` / `An upload was never finished` · the opportunity title · `12 families never started therapy and have no reason recorded` / `Some families never started therapy and have no reason recorded` (count under 11).
- Sub-lines: `Uploaded Mon D, YYYY` · `Started Mon D, YYYY` · `<funder> · closes Mon D, YYYY` (`Funder not recorded`) · "Approved more than 60 days ago with no first session. Recording the reason keeps the never-started measure honest." or the approved suppression sentence.
- Links: `Open uploads` (`/staff/intake`) · `Open grant matches` (`/staff/grants/matches`) · `Enter a case` (`/staff/entry`).
- Empty: `Nothing needs you this week` + "Every upload is finished, no grant you are working on closes in the next 30 days, and every family who never started therapy has a reason recorded."
- Error: `Couldn't check what needs you` + the kit's error sentence. Partial: `Couldn't check uploads this time; the rest is shown.`
- Public sources: `CDC PLACES`, `ProPublica nonprofit filings`, `HRSA mental-health shortage areas`, `VA veteran population`, `Census American Community Survey`, `Census SAHIE`, `Census SAIPE`, `Grants.gov`, `USAspending federal awards`, `Utah State Courts`. Vintage: `Latest <vintage>` — "The newest release of this source we have loaded. The source labels releases by year or month." · `No load yet` — "Nothing from this source has been stored yet. The release label appears after the first successful run."

## States
Items · empty · error (all three reads failed) · partial (one or two reads failed: rows from the rest plus the "Couldn't check …" line). No loading state (server render).

## Trust rules
Every row maps to a stored row; no row is invented and no count is shown as 0. The family count is hidden under 11 with the approved sentence. Upload and grant dates are operational dates, so they may show a day; family data shows no date at all on this card. Grant rows are items, not counts, so suppression does not apply to them.

## Accessibility
The card is a `section` labelled by its h2; rows are an `ol`; the badge is a 44 px `Hint` trigger whose words are the same on hover, focus and tap; one link per row (outline button, 44 px); the vintage text is a `Hint` trigger with a dotted underline; axe 0 serious/critical at 375 and 1024; `scrollWidth` ≤ 375.

## Acceptance criteria → tests
| # | Criterion | Test |
|---|---|---|
| 1 | "Needs you" rows come only from stored uploads, pipeline deadlines and never-started families; order fix rows → unfinished → deadlines → missing reason; three per kind; family count through `suppressCount`; empty and error states | `lib/staff/todo.test.ts` (4 cases); `tests/e2e/home.spec.ts` (card, badges with hints, one link per row, never `0 rows`/`0 families`) |
| 2 | Public sources show names in words and the vintage column in words with a hint | `lib/staff/home.test.ts` (`sourceName`, `vintageWords`); `home.spec.ts` (no code pattern, `Latest …`/`No load yet` trigger) |
| 3 | The summary sentence precedes the actions in the header at every width | `home.spec.ts` (`compareDocumentPosition`) |
| 4 | No overflow at 375; 44 px controls; axe clean (unchanged DS-10a AC6) | `home.spec.ts` |

## Allowed files
`lib/staff/todo.ts` (new), `lib/staff/todo.test.ts` (new), `components/staff/TodoList.tsx` (new), `components/staff/HomePage.tsx`, `lib/staff/home.ts`, `lib/staff/home.test.ts`, `components/layout/index.tsx` (one type), `tests/e2e/home.spec.ts`, `docs/design/specs/DS-10a.md`, `harness/progress.md`.

## Estimate
~245 added, ~15 deleted ≈ 260 hand-written lines (markdown excluded). One PR.

## Decisions
- "Uncommitted" upload batches: the database only writes `committed` and `rolled_back` (and the synthetic seed `ok`), so the rule is "status outside those three, or `rows_error > 0`". No invented draft state.
- Grant deadlines come from `pipeline_status` (the grants FAS is actually working on), not from every scored match, so the list is short and personal; stages Submitted, Awarded, Declined and Passed are not due anything.
- The never-started rule uses the M3 view's own 60-day window and the stored `unknown` reason, so the to-do and the dashboard measure agree.
- Sparkline hover is deferred (see Scope 4).

## Open questions
1. Sparkline hover needs a small hover layer sized for 120 × 32 (or a `size` prop on `LineHover`); DS-15a owns the dashboard hover files, so it should land there or in a later home packet.
2. The "Families helped, by month" chart still has no monthly series field (DS-10a open question 2).
3. The `Enter a case` link opens the entry form; there is no route to edit an existing episode's reason yet, so staff record the reason through the next upload or entry.
