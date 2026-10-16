# Plan: DS-20 (County need map, declutter) and DS-21 (fewer sidebar links, tabs inside pages)

Asked by George, 2026-10-16: "polish the county map page, fix the cluttered, hard-to-read data at the bottom of the map; make it easy to see, read and understand." Follow-up: "organize the pages better; the many data pages in the sidebar could be one page with tabs."

Status: **plan decided, no code yet.** George asked the designer to make the four open calls using standard UI/UX practice (2026-10-16); they are recorded under "Design decisions" at the end. All four packets are unblocked.

---

## What is wrong today (audit, 2026-10-16)

Rendered locally from `main` with 13 synthetic indicators across SAHIE, SAIPE and ACS (the same set production loads), at 1440 and 375.

| # | Where | Problem | Evidence |
|---|---|---|---|
| 1 | Table | **18 columns** (County, Rank, Need score, Band, 13 measures, Status). Needs sideways scroll even at 1440; Veterans is cut off. | `NeedTable.tsx` renders every loaded column |
| 2 | Table | Measures sorted **alphabetically by code**, so counts and rates interleave (`In child poverty`, `Child poverty rate`, `No-vehicle (count)`, …). No topic order. | `query.ts` `codes … .sort()` |
| 3 | Table | Every cell wraps to **2–3 lines**: `1 / of / 29`, `3,090 / people / ± 310`. The noun ("people", "households") and the margin of error repeat in all 377 cells. Rows are ~60 px; the table is ~1,800 px tall. | `NeedMapQuery.cell` |
| 4 | Table | Headers wrap to 4 lines **plus a source note under every header** ("Census ACS 5-year 2023" seven times). | `NeedTable.tsx` header `c.note` |
| 5 | Table | Rank, Need score, Band ("5 of 5") and Status ("Ranked") say the same thing four ways. | |
| 6 | Panel | A selected county lists all 13 measures, **each with its own source line** → panel ~1,100 px. The sticky panel pushes the legend below it, leaving a large empty area under the map. | `CountyPanel.tsx` `Indicator` |
| 7 | Legend | Legend sits under the panel, far from the map. "Placeholder bins" appears three times (legend title, legend note, page footer). | `NeedMap.tsx` figcaption |
| 8 | Empty panel | Before a pick, the right column is an almost-empty "Select a county" card. | |
| 9 | 375 | With a county selected the page is **5,660 px** tall. | |

None of this is a data problem: every number is right and traceable. It is a **hierarchy** problem: everything is shown at once, at the same weight.

## Design principle for the fix
1. **Map first, one county second, full table last.** The page answers "where is need greatest?"; the table is reference material.
2. **Show the 5 measures that drive the score by default** (v2 weights: poverty, child poverty, uninsured, single-parent, no-vehicle; `docs/DESIGN.md` Need score rule 3). Everything else is one click away, never deleted.
3. **Say it once.** Units in the header, not every cell; source once per group, not per row; margin of error in the hover card, not inline.
4. No number changes, no new data, no new tables. Every value still comes from the same stored row (golden rule 4) and every hover card keeps source, vintage, as-of and margin.

---

## DS-20 — Need map declutter (3 PRs, each ≤ 400 lines)

### DS-20a — Layout and legend
- **Legend moves directly under the map**, same column, as one compact strip: five swatches with "Lower need → Higher need", then `Not published` and `FAS county (outlined)` chips. Band hints (score range, county count) stay on hover/focus.
- One small note under the strip: "Relative ranking · placeholder bands until FAS sets the weights." Remove the duplicate lines.
- **Right column = county panel only.** Before a pick it shows **"Highest need"**: the top 5 counties as clickable rows (rank, name, score, swatch), plus "Select any county on the map." The empty card goes away and the page's question is answered at a glance.
- Page footer: one deduplicated line (sources · score version · as of).
- Files: `components/need-map/NeedMap.tsx`, `CountyPanel.tsx`, `lib/need-map/words.ts`, `app/(app)/need-map/page.tsx`, tests in `need-map-svg.test.ts`, `tests/e2e/map.spec.ts`.

### DS-20b — County panel
- Header: county name, FAS badge, then one big line: **"3rd highest need of 29 · Highest need band"**, then the existing plain-English sentence.
- **Key measures:** the 5 scored rates as the existing bars against the state median (`CompareBars`), one line each: label · value · "higher than 22 of 28".
- **All measures (13)** in a closed `<details>` disclosure, **grouped by source** (Health coverage — Census SAHIE 2023 · as of Oct 2026; Poverty — Census SAIPE 2023; Households and population — Census ACS 5-year 2023). Value only; `±` margin stays as a hover `Hint`. One source line per group, not per row. This still meets DESIGN need-map rule 5 ("each with source and as-of") because every measure sits under its source heading (decision 3).
- Expected panel height: ~450 px closed (from ~1,100).
- Files: `CountyPanel.tsx`, `CompareBars.tsx`, `lib/need-map/compare.ts`, new pure `lib/need-map/groups.ts` (topic/source grouping + fixed measure order), `county-panel.test.ts`.

### DS-20c — County table
- **Default view "Key measures":** County · Rank · Need score (with band swatch) · Uninsured % · Poverty % · Child poverty % · Single-parent % · No-vehicle %. **9 columns, fits at 1024 with no sideways scroll.**
- A two-option switch above the table: **Key measures | All measures** (`?cols=all`, link-based so it works without JS). "All measures" shows every loaded column in the fixed topic order from `groups.ts` (rates first, then counts), still scrollable.
- Cells: **one line, numbers only** (`whitespace-nowrap`). Rank shows `1`, not `1 of 29` (header says "Rank of 29"). Units move to the header ("Uninsured (people)"). The `±` margin moves into the cell's hover card, which already shows it.
- Headers: short label on at most two lines. Per-header source notes are replaced by one "Sources" line under the table; the header hover keeps source and as-of (DESIGN need-map rule 6).
- Drop the **Status** column and the "Band (placeholder)" text column: a `Not published` county shows the hatch swatch and "Not published" in the score cell; unscored counties still sort last (rule 8).
- Sticky header row, row hover highlight, the **selected county's row highlighted** to match the map, FAS rows keep the "FAS county" text badge (rule 2) but shorter ("FAS").
- Expected table height at 1440: ~1,200 px (from ~1,800), no sideways scroll in the default view.
- Files: `NeedTable.tsx`, `lib/need-map/query.ts` (cell format without noun/MoE; MoE kept as a separate field for the hover), `lib/need-map/terms.ts`, `need-map.test.ts`, `map.spec.ts`.
- Later, optional: click a header to sort by that measure.

### Mobile (375), across a–c
The ranked list stays. The legend strip wraps to two rows. The panel uses the same closed disclosure. Target: < 3,000 px tall with a county selected (from 5,660).

### Done means (each sub-packet)
Shots at 375/1024/1440 before and after (+ a 1024 hover on a table cell and a selected-county shot), axe 0 serious/critical, no horizontal overflow at 375, existing explain cards still show value, margin, source and as-of, smoke check and `map.spec.ts` green.

---

## DS-21 — Fewer sidebar links: sections with tabs

### Today
Workspace has **10 links** (Home, Team dashboard, County need map, Data freshness, Evidence packets, Upload data, Enter data, Foundation grants, Grant matches, Methodology) + Board + Admin = 12.

### Proposed (staff and admin): 10 → 5 workspace links
| Sidebar link | Tabs inside the page | Existing routes (unchanged) |
|---|---|---|
| **Home** | — | `/staff` |
| **Insights** | Team dashboard · County need map | `/dashboard`, `/need-map` |
| **Data** | Upload · Enter by hand · Freshness · Methodology | `/staff/intake`, `/staff/entry`, `/data-freshness`, `/methodology` |
| **Grants** | Foundation grants · Matches | `/staff/grants`, `/staff/grants/matches` |
| **Evidence packets** | — | `/staff/packets` |
| Board → Board dashboard | — | `/board` |
| Admin → Overview (admin only) | — | `/admin` |

Board viewers keep their short list (Board dashboard, County need map, Methodology); no tabs for them.

### How (simplest path)
- **Keep every URL.** Tabs are links to the existing routes, not new routes. That means no change to auth, role guards or middleware, no redirects, bookmarks and e2e tests keep working, and board viewer access is untouched.
- New pure `lib/shell/sections.ts`: section → tabs, filtered by role; `sectionFor(pathname)`.
- `lib/shell/nav.ts`: Workspace shows the 5 section links; a section link is active when any of its tabs is the current page. Crumb becomes "Data · Upload".
- New `components/shell/SectionTabs.tsx`: a `nav` of link tabs under the page header (`aria-current="page"`, 44 px targets, scrolls sideways at 375 instead of wrapping), rendered by `ShellFrame` when the path belongs to a section.
- `components/shell/nav-icons.ts`: one glyph per section.
- Tests: `lib/shell/nav.test.ts`, new `sections.test.ts`, `tests/e2e/nav-admin.spec.ts` (5 links, tabs present, active tab, axe and overflow at 375/1024/1440).
- Size: one PR, ~250 lines. Shell files only, so it runs **in parallel** with DS-20 (no shared files).

### Not recommended
Moving routes to `/data/upload` etc. More churn (role-guard lists, redirects, every e2e path) for no user-visible gain.

---

## Order
1. DS-21a and DS-20a in parallel (disjoint files).
2. DS-20b.
3. DS-20c.
Each: spec in `docs/design/specs/`, branch off `main`, draft PR with shots, merge on green CI and QA PASS (D-013, D-037).

## Design decisions (made 2026-10-16, at George's request)

| # | Question | Decision | Why (the practice behind it) |
|---|---|---|---|
| 1 | Section names; where Methodology goes | **Home · Insights · Data · Grants · Evidence packets.** Methodology goes under **Data**, as the last tab: Upload · Enter by hand · Freshness · Methodology. | Name each section by what the user is there to do, in one plain word, and keep the sidebar to 5–7 items so people can take it in at a glance (Hick's law). "Data" holds everything about where the numbers come from: putting data in, how current it is, and how it is calculated. That makes "Insights" purely the place to read results. Board viewers keep their direct Methodology link. |
| 2 | Table default | **Key measures by default** (the 5 rates that make up the need score), with a **Key measures \| All measures** switch that is kept in the URL (`?cols=all`). | Show the most important things first and let people open the rest when they need it (progressive disclosure). Default to what drives the decision. The 5 scored rates are what explain a county's rank. The counts are reference figures, and they stay one click away. Keeping the switch in the URL makes it survive a reload, a shared link and the back button. |
| 3 | Panel sources | **Show the source and "as of" date once per group** (group heading), not under every measure. Each measure's hover card still shows its own source, year, as-of date and margin of error. | Say it once: when every row repeats the same text, the eye has to skip it 13 times. A group heading shows which measures share a source (proximity) and is honest because each group has exactly one source. The DESIGN need-map rule 5 still holds: each measure is shown with its source and as-of date, now at the group level. |
| 4 | Table placement | **Keep the table visible under the map**, in the Key measures view, with the heading "All 29 counties". No collapse. | Do not hide the accessible alternative to a chart: the table is how keyboard and screen-reader users, and anyone comparing exact numbers, read the map. Once it is trimmed to 9 one-line columns it is no longer clutter, and hiding it would only cost a click. |

### House rules these decisions add (apply to every later data page)
1. **One line per cell.** Numbers do not wrap. Units go in the column header, not in each cell.
2. **Say it once.** Sources, versions and "placeholder" notes appear once per section, never once per row.
3. **Default to the score's inputs.** A ranked view opens on the measures that make up the rank. Everything else sits behind a switch kept in the URL.
4. **A sidebar link names a task, not a page.** When pages serve one task, they become tabs on one section, and the URLs do not change.
