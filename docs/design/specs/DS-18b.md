# DS-18b — Enter data, Admin overview and the shell nav: every field says what to enter and why, every nav link has a glyph, both pages load into a skeleton
Source docs: `docs/design/POLISH_PLAN.md` row DS-18a/b; `docs/design/fas-screen-plan-part2.md` §4 "Manual entry forms ×5 (F-302)" and §1.2 nav; no mockup exists for `/staff/entry` or `/admin` (DS-10a shipped the admin home from `visual-direction.md`); `.claude/skills/design-polish/references/*`; DS-10a (home), DS-14 (skeletons, spec format), DS-15a (`m4Cell` attribute builder pattern).
**Depends on:** DS-14 `PageSkeleton` on main (#262). **Sibling:** DS-18a (`/staff/intake`, `components/intake/**`) runs in parallel on its own branch; this file is the b half and may be folded into `DS-18.md` later. **Budget:** ≤ 400 hand-written lines (D-012). **Before/after shots:** taken by the supervisor from production and the preview (`/staff/entry` as staff; `/admin` as admin; the nav rail at 800).

## Purpose and users
Staff add one record at a time between calls; the form must tell them, beside every field, what to type, why FAS asks for it and what the number later feeds, so no one guesses a date format or a code. The admin's overview is the first screen they see and must load into a shape that looks like itself. The shell nav serves every role on every width; at 768–1023 it collapses to a 56 px rail where the glyph is the only thing left of a link, so every link needs one.

| Role | Gets |
|---|---|
| staff, admin | `/staff/entry`: eyebrow + headline in words; a plain-words helper sentence under every field that has a rule, wired with `aria-describedby`; a skeleton while the server renders |
| admin | `/admin`: a skeleton shaped like the home page while the server renders (the eyebrow, greeting and serif sentence shipped in DS-10a) |
| staff, admin, board_viewer | one lucide glyph, 16 px, `aria-hidden`, on all 12 nav links in the sidebar, the rail and the sheet |

## Scope (sub-packet b)
- `/staff/entry` header: eyebrow `Enter data`, H1 `Add one record at a time`, one sentence under it.
- Field helper text: `hintFor` (`lib/intake/entry.ts`) gains per-field plain words in a new pure module `lib/intake/words.ts` (what to enter, why, what it feeds), falling back to the type words. The form already renders `hintFor` under the control with `id="entry-<key>-hint"` and lists it in `aria-describedby`, so every field with a rule now has a described-by sentence without touching the form.
- Aggregate words: `lib/intake/words.ts` also carries the pure builders for the follow-up that puts the recent-totals list under one `ExplainLayer` (`aggregateCell`, `m4Cell` pattern) and the `Hint` text for the Σ badge (`AGGREGATE_BADGE_HINT`), with unit tests.
- Nav icons: `components/shell/nav-icons.ts` maps all 12 hrefs to lucide glyphs; `ShellFrame` renders them at 16 px (`size-4`), `aria-hidden`, default stroke.
- `loading.tsx` for `/staff/entry` (form-shaped) and `/admin` (home-shaped) through `PageSkeleton`.
- **Deferred (file ownership, not budget):** wiring the Σ badge `Hint` and the recent-totals `ExplainLayer` into `components/intake/AggregateForm.tsx`, and the aggregate form's own helper words (`HINT` in that file). `components/intake/**` belongs to DS-18a this week and `components/trust/index.tsx` is kit-only, so the builders land here and a follow-up (DS-18c) wires them in two or three lines each once DS-18a merges. See Open questions 1.
- Out of scope: new fields, schema, migrations, the admin "Where to look" card copy, `/staff/intake`.

## Audit (filled before code)
### Context
- Mockup: none. Screen plan: "Manual entry forms ×5: single-column forms, max 640px, validation shared with upload; no notes fields; errors inline." Existing specs: none for `/staff/entry`; DS-10a for `/admin`. Code: `app/(app)/staff/entry/page.tsx`, `components/intake/EntryForm.tsx`, `components/intake/AggregateForm.tsx`, `lib/intake/{entry,schema,aggregate}.ts`, `app/(app)/admin/page.tsx`, `components/staff/HomePage.tsx`, `components/shell/ShellFrame.tsx`, `lib/shell/nav.ts`.
- Before shots: supervisor, from production.

### First impression (critique)
`/staff/entry` reads as a form, not a finished page: the eyebrow is a group name (`WORKSPACE`), the H1 is a nav label (`Enter data`), and only four of the five field types carry a hint, each a bare format (`Like 2024-03-31`) with no why. `/admin` already reads well (dated eyebrow, greeting, one serif sentence, three explained tiles); its only gap is a blank main region during the server render. The sidebar shows a house on 8 of 12 links (the `?? House` fallback), so at 800 px the rail is eight identical houses.

### Numbers inventory
| Element | Has hover card? | Term id | Source shown? | As-of shown? | Hidden reason wired? | Action |
|---|---|---|---|---|---|---|
| Recent aggregate totals rows (`[data-slot=aggregate-recent] li`) | No | aggregate | No | period only | n/a | builders in this packet; wiring deferred (ownership) |
| Σ Aggregate badge (notice + rows) | No (`aria-label` only) | aggregate | — | — | — | hint text in this packet; wiring deferred (ownership) |
| `Saved Case 1a2b3c4d` id | No | — | — | — | — | kept; the id is the thing the next form needs |
| `/admin` tiles, sources, chips | Yes (DS-10a) | m1, m2, m4, fresh_* | Yes | Yes | Yes | none |

### Controls under 44 px below 1024
| Control | Measured at 375 | Fix |
|---|---|---|
| Entry inputs, selects, buttons | ≥ 44 (`entry-forms.spec.ts` asserts) | none |
| Nav links | 44 (`globals.css`) | none; the glyph is inside the link |

### Layout
| Width | Horizontal scroll? | h1 left / content width | Reading order = visual order? | Notes |
|---|---|---|---|---|
| 375 | No | 16 / 343 | Yes | eyebrow, H1, sentence, selector, fields stacked |
| 1024 | No | 288 / 704 | Yes | single column; hint under each control |
| 1440 | No | 288 / 1120 | Yes | same; form stays narrow by its own fields |

### States present
| State | Exists? | Copy | Fix |
|---|---|---|---|
| Entry: county list failed | Yes | "Couldn't load the county list" + reference id + Try again | kept |
| Entry: validation | Yes | alert count + inline `✕` lines | kept |
| Entry: saved | Yes | "Saved Case <id>", Add another, Copy id | kept |
| Entry: loading | **No** (falls through to `/staff`'s home skeleton) | — | `app/(app)/staff/entry/loading.tsx` |
| Admin: loading | **No** | — | `app/(app)/admin/loading.tsx` |
| Permission denied | Yes | 403 | kept |

### Accessibility (manual)
| Finding | Impact | Fix |
|---|---|---|
| `court_involved`, `referral_source`, `county_fips`, enums and text fields have no described-by sentence; required-ness is only a badge | moderate | per-field words through the existing `aria-describedby` wiring |
| Rail at 768–1023 shows the same glyph for 8 links; `aria-label` saves screen readers, sighted users get no cue | moderate | one meaningful glyph per link |
| Skeleton for `/staff/entry` announces "Loading your home" | minor | own `loading.tsx` with "the entry form" |

### Copy faults
| Text | Where | Replacement |
|---|---|---|
| `WORKSPACE` eyebrow | entry header | `Enter data` |
| `Enter data` H1 | entry header | `Add one record at a time` |
| `Like 2024-03-31` | date hints | field sentence naming the day, the format and the rule it must keep |
| `Paste the parent record id` | ref hints | names the parent, where the id comes from and that it must be in your organization |
| `County code (Utah FIPS)` label | schema label (kept) | the hint says "The Utah county the family lives in"; the label itself is an F-302 string shared with the upload mapper, left for DS-18a |

### Tokens and styling faults
| Finding | File:line | Fix |
|---|---|---|
| Nav glyph takes lucide's default 24 px; the rail centres it | `ShellFrame.tsx` NavLinks | `size-4 shrink-0` (16 px token) |

### Mockup gaps
None (no mockup). Screen-plan "Audit toast" is not adopted: the app writes an `audit_log` row but shows no toast, and the saved line already confirms the save.

### Estimate
~230 hand-written lines (words + tests ~95, nav icons + test ~45, entry header 6, two skeletons + test 14, e2e ~70). One PR.

## Layouts
| Viewport | `/staff/entry` | `/admin` skeleton | Nav |
|---|---|---|---|
| 375 | one column; hint under each field; H1 28 px serif | header bars + 3 / 2 / 1 blocks stacked | sheet: glyph + label |
| 800 | one column | grid blocks | 56 px rail: glyph only, label sr-only |
| 1024 / 1440 | one column, content ≤ 1200 | grid blocks as the home | 256 px sidebar: glyph + label |

## Components (existing only)
`PageHeader`, `Stack`, `ErrorState` (layout); `PageSkeleton` (status); `EntryForm`, `AggregateForm` (unchanged, DS-18a's files); lucide glyphs. New files: `lib/intake/words.ts`, `components/shell/nav-icons.ts`, two `loading.tsx`.

## Exact copy
- Eyebrow `Enter data`; H1 `Add one record at a time`; sentence `Choose what you are adding. Each field says what to enter and why. The same checks run as for uploads before anything is saved.`
- Field words: see `FIELD_HELP` in `lib/intake/words.ts` (one or two sentences each; the day format `like 2024-03-31`, the dollar format `like 1840.00`, "a whole number of 0 or more", the parent record and the Copy id button, what the field later feeds: the wait to a first session, the time to a funding decision, the completion rate, the cost per completed episode).
- Skeleton sentences: `Loading the entry form. The page appears in a moment.` and `Loading your home. The page appears in a moment.`
- Σ badge hint (for the follow-up): the glossary `aggregate` sentence, `A total that FAS entered as a total, not built up from individual records.`
- Aggregate cell (for the follow-up): term `aggregate`; value `<total> <metric>, <period>, <county or All counties>`; source `FAS aggregate total, entered by staff`.

## States
Unchanged on both pages except the new loading faces. No new empty or error state is introduced.

## Trust rules
No number changes. Helper sentences describe only rules the validator enforces (`validate.ts`: required, date format and order, whole number minimums, dollar format, allowed values, Utah county, parent id in the caller's organization) and only metric links that exist in the glossary (M1, M2, M4, M5). No toast, no logging claim. Builders for the aggregate card say "entered by staff" because that is what `aggregate_submission` is; the as-of row is left empty because the table stores a period, not a date.

## Accessibility
Every visible entry field lists its hint id in `aria-describedby` (the error id joins it when present); the sentence is `text-sm text-muted-foreground`, ≥ 12 px. Nav glyphs are `aria-hidden`; the link keeps `aria-label`. Skeletons are `role="status"` with one sr-only sentence. axe 0 serious/critical at 375/1024/1440 on both routes; `scrollWidth` ≤ viewport; inputs 16 px; targets ≥ 44 px below 1024 (all asserted).

## Acceptance criteria → tests
| # | Criterion | Test |
|---|---|---|
| 1 | Every field with a rule has plain helper words: `fieldHelp` returns a sentence for every non-hidden field of all five entities, names the format for dates and money, the parent for ids, contains no banned string | `lib/intake/words.test.ts` |
| 2 | On `/staff/entry` every visible Case field's control lists an `entry-<key>-hint` id in `aria-describedby` and that element has words; header reads eyebrow + "Add one record at a time" | `tests/e2e/entry-forms.spec.ts` "every field explains itself" (+ heading update) |
| 3 | All 12 nav hrefs have an icon; no two Workspace links share a glyph; the fallback is never used | `lib/shell/nav-icons.test.ts` |
| 4 | Every sidebar link renders one `aria-hidden` svg of 16 × 16 at 1440; at 800 the rail shows the glyph with the label hidden and links ≥ 44 px; `/admin` axe clean and no overflow at 375/1024/1440 | `tests/e2e/nav-admin.spec.ts` |
| 5 | `/staff/entry` and `/admin` ship a `loading.tsx` using `PageSkeleton` | `lib/status/skeleton.test.tsx` (routes added) |
| 6 | `aggregateCell` and `AGGREGATE_BADGE_HINT` produce the attributes an `ExplainLayer` reads and the glossary sentence | `lib/intake/words.test.ts` |

## Allowed files
`app/(app)/staff/entry/page.tsx`, `app/(app)/staff/entry/loading.tsx` (new), `app/(app)/admin/loading.tsx` (new), `lib/intake/entry.ts`, `lib/intake/entry.test.ts`, `lib/intake/words.ts` (new), `lib/intake/words.test.ts` (new), `components/shell/ShellFrame.tsx`, `components/shell/nav-icons.ts` (new), `lib/shell/nav-icons.test.ts` (new), `lib/status/skeleton.test.tsx`, `tests/e2e/entry-forms.spec.ts`, `tests/e2e/nav-admin.spec.ts` (new), `docs/design/specs/DS-18b.md`, `harness/progress.md`.

## PR split
One PR (b). Follow-up DS-18c after DS-18a merges: wire `Hint` + `aggregateCell` into `AggregateForm.tsx`, replace its `HINT` map with words from `lib/intake/words.ts`.

## Decisions
1. The nav-icon test lives in a new spec file rather than `tests/e2e/shell.spec.ts`, which two open PRs (#251, #252) already edit.
2. The admin H1 stays the DS-10a greeting (the home e2e asserts it); the "headline in words" there is the serif summary sentence already shipped.
3. Glyph choices: Home `House`, Team dashboard `ChartColumn`, County need map `Map`, Data freshness `Clock`, Evidence packets `FileText`, Upload data `Upload`, Enter data `ClipboardPen`, Foundation grants `Landmark`, Grant matches `Target`, Methodology `BookOpen`, Board dashboard `LayoutDashboard`, Overview (admin) `Shield`. Default lucide stroke on all.
4. Helper words name what a field feeds only where the glossary names that metric; nothing else is promised.

## Open questions
1. `components/intake/AggregateForm.tsx` owns the Σ badge, the recent-totals list and the aggregate `HINT` map; it is DS-18a's file this week. The `Hint` and `ExplainLayer` wiring (two to three lines each, builders ready here) needs a follow-up once DS-18a merges. **Resolved by DS-25** (the DS-18c follow-up, folded in).
2. The `County code (Utah FIPS)` label is an F-302 schema string shared with the upload mapper (`INTAKE_SCHEMA`); renaming it to "County" belongs with DS-18a's intake wording so both screens change together.
