# FAS Evidence Screen Plan & Designs v1 (part 2)

*Continues [fas-screen-plan.md](fas-screen-plan.md) (§0–3).*

## 4. Screen specifications

Key:
- **E / L / Er / PD** = empty / loading / error / permission-denied.
- **Trust** = which trust rules apply.
- **A11y** = accessibility notes.

### P0 — now (fix the shell; usable by all roles)

**P0-1 Sign in** (`/login`). Mockup: `mockups/p0-login.png`

| | |
|---|---|
| Purpose | Get each role into the right home securely and with calm. |
| Layout | Split 50/50. Left: form card, max 400px. Right: `--sidebar` panel with a serif value line, an example KPI card and a privacy note. On mobile, a single card. |
| Components | Wordmark, H1 (serif), labeled inputs, show/hide password, lg primary button, destructive alert, "Forgot password?" link, environment badge. |
| Data | None. The example KPI is labeled "Example". |
| States | L: button shows "Signing in…" and is disabled. Er: generic credentials error; lockout notice; the "Supabase not configured" case becomes a friendly "Sign-in is temporarily unavailable". Already signed in → redirect. |
| Trust | The privacy note ("Counts under 11 are hidden. Every sign-in is logged.") sets expectations. |
| A11y | Labels above fields. The error alert is `role="alert"` and focus moves to it. Password toggle has `aria-pressed`. Autocomplete attributes set. |

**P0-2 App shell + Staff home** (`/home`). Mockup: `mockups/p0-staff-home.png`

| | |
|---|---|
| Purpose | Replace the 800px placeholder. Give staff "what needs me this week". |
| Layout | 256px sidebar (collapses to 56px) + 56px top bar + content (max 1280px). Home has a greeting and two actions (Enter a case, Upload data), 3 KPI cards (M1, M2, completion), a To-do table and a freshness card. |
| Components | Sidebar with groups and counts; breadcrumbs; freshness chip; env badge; user menu; KPI card; badges; table rows with a single action each. |
| Data | M1, M2 and M4 summary vs. the prior quarter. To-dos come from upload_batch errors, pipeline deadlines, strategy_draft status, and missing non_start_reason. Source freshness comes from source_registry/ingest_run. |
| States | E (first run): "Upload your first case file" + template link; KPIs show "No FAS data yet". L: skeleton cards. Er: per-card error with retry; the shell stays usable. PD: nav items hidden per role; a direct URL goes to the 403 screen. |
| Trust | Every KPI has a footer with source, period, n and as-of date. Deltas use an arrow plus words ("↓ 4 days vs Q2"). Freshness uses icon + word + color. |
| A11y | `nav` landmark with `aria-current`. Counts announced ("12 matches"). To-do actions are distinct buttons with visible labels. |

**P0-3 Forbidden** (`/403`). Mockup: `mockups/p0-403.png`

| | |
|---|---|
| Purpose | Explain *why* there's no access and give a way back. |
| Layout | The shell stays visible with role-filtered nav. Centered card, max 560px. |
| Components | Icon, eyebrow "Error 403 · No permission", H1 naming the area, explanation that includes the user's role, primary "Go to <home>", secondary "Ask an admin for access", requested path shown in mono. |
| States | This screen *is* the PD state. Variant: "Account not set up" (no role). |
| Trust | States that the attempt was logged (audit_log). Never reveals which data exists. |
| A11y | H1 receives focus on load. Real HTTP 403 (fixes issue #13). |

**P0-4 Board home** (`/board`). Mockup: `mockups/p0-board-home.png`

| | |
|---|---|
| Purpose | A read-only reading room: get the latest packet in one click and see three plain-language results. |
| Layout | Simplified sidebar (4 items, read-only footer). Hero card with a packet thumbnail and Download PDF. Next-meeting card. "This quarter at a glance" row of 3 KPIs. |
| Data | Latest board export_job, next meeting date (org settings), suppressed aggregates (families started, M1, M6 with rates). |
| States | E: "Your first board packet will appear here after staff publish it." L: skeleton. Er: "Packet couldn't load. Try again." PD: n/a (board home). If a board account has no org, show "Account not set up". |
| Trust | Aggregates only, quarter dates, an "as of" date on each card, M6 next to rates, related party named. |
| A11y | Large type, plain words, Download is the first focusable action. The PDF must be tagged and accessible (F-403). |

**P0-5 Not found / error boundary / session expired.** Same card pattern as 403. Session expired keeps the redirect target.

**P0-6 Reset password + invite accept** (`/reset-password`, `/invite/accept`). Steps: email → "Check your email" → set password, with strength rules. Errors: expired or invalid link. This is required before board launch (F-605).

**P0-7 Trust component kit** (no route): suppressed cell, hidden-cell, source footer + provenance sheet, freshness chip, not-published, Aggregate badge, DRAFT banner, empty/error/PD templates. It's built once and used by every P1/P2 screen.

### P1 — next (MVP: Phases 2–4)

**P1-1 Team dashboard** (`/dashboard`, F-401). Mockup: `mockups/p1-team-dashboard.png`

| | |
|---|---|
| Purpose | One place for staff to see whether FAS help works, ready to cite. |
| Layout | Header (title, period summary, freshness chip, Export packet). Filter bar (date, county, referral source, compare) + suppression legend. **Headline M1 card**, full width, with distribution stats and a trend. 3-up M2/M3/M5 cards. M4 table (income band) + M6 card (stacked share bar + rate table). Below the fold: O1 outcomes and the pipeline widget. |
| Data | `m1…m6` views and O1. Filters map to query params. n per metric. |
| States | E: "No FAS data for this period" + change filters / upload. L: skeletons per card. Er: per-card error, other cards stay usable. PD: board → 403 (board uses P1-2). Filter-no-results: "No cases match County X + Self-referral" with a reset. Ag: badge on any metric fed by aggregate submissions. St: chip turns "Stale" with the date. |
| Trust | Suppressed 300%+ band shown with hatching; the 200–299% band is hidden for complementary suppression so it can't be worked out from the total. Every card has a source footer. M6 always shows rates. The trend has a text label. |
| A11y | Chart `aria-label` summary + "View as table". Deltas say faster/slower in words. Filter chips are buttons with `aria-expanded`. |

**P1-2 Board dashboard, print-friendly** (`/board/print`, F-402). Mockup: `mockups/p1-board-dashboard.png`

| | |
|---|---|
| Purpose | One letter-size page a board member can read in 2 minutes, on screen or paper. |
| Layout | A white 8.5×11 sheet. Eyebrow, serif H1 with the quarter, "Data as of", a one-sentence plain-language summary, a 3-KPI rule row, then sections: "Did families improve?", "Where our therapy dollars went" (M6 + rates), "Need in the counties we serve", sources/suppression footnote and a page number. |
| Data | Suppressed aggregates only, quarter granularity, need rank. |
| States | E: "Not enough data this quarter to publish" (all cells suppressed). L: skeleton sheet. Er: retry. PD: none (all roles). Print: toolbar hidden, light theme, no sidebar, footers kept. |
| Trust | "—" with a plain-language explanation; no exact dates; county level; related party named in the table; sources paragraph. |
| A11y | Real tables with headers. Reading order matches the visual order. Minimum 11pt in print. |

**P1-3 Upload wizard — Map columns step** (`/upload`, F-301). Mockup: `mockups/p1-upload-mapping.png`

| | |
|---|---|
| Purpose | Turn FAS's own spreadsheet into validated records without retyping. |
| Layout | Header with file name + row count. 5-step stepper (Upload · Map · Validate · Preview · Commit). Mapping table (your column, sample values, →, FAS Evidence field select, status). Right rail: summary counts, blocking alert, privacy note, "Save this mapping". Footer: Back / Validate N rows (disabled until required fields are mapped, with the reason shown). |
| Data | Parsed headers + 3 sample values, saved mapping (upload_batch.mapping), the field schema. |
| States | E (step 1): dropzone + template download. L: "Reading file…" with a progress bar. Er: wrong type or too large, unreadable sheet. Partial: needs-review rows. PD: board → 403. Other steps: Validate (per-row error table + downloadable CSV report), Preview (counts per table + changes), Commit (success + rollback link). |
| Trust | Free-text columns can't be imported (no clinical notes). County values are normalized to FIPS with a review step. |
| A11y | Each select is labeled by its source column. Status uses icon + text. The disabled primary button explains why. Errors link to their rows. |

**P1-4 County need map** (`/need-map`, F-210/211). Mockup: `mockups/p1-county-map.png`

| | |
|---|---|
| Purpose | Show where need is highest across all 29 counties, with sources, to steer growth and back grants. |
| Layout | Header + Map/Table toggle + Methodology. The left card has layer/vintage filters and a 29-county map (the mockup shows a schematic tile cartogram; build it with real county geometry plus a tile fallback on small screens). Legend with numeric bins + Not published. Source footer. Right panel: the selected county's indicators, each with source, vintage, MOE and stale/not-published states, plus actions. |
| Data | need_score (version), public_indicator per county, source_registry freshness. |
| States | E: "Need score not computed yet". L: map skeleton. Er: retry; the table still loads. PD: none (public data, all roles). NP: 3 counties hatched "Not published". St: per-indicator stale tag. Failed source: show "Not published" rather than old data. |
| Trust | Each tile shows rank and score as text, so it isn't color alone. "Relative ranking, not absolute need" disclaimer. Every indicator shows its source and date. |
| A11y | The table view is the accessible equivalent (sortable). Tiles are buttons with an `aria-label` ("Carbon County, rank 4 of 26, score +1.74"). Arrow keys move between tiles. |

**Other P1 screens.** Specs are summarized; each uses the shared states and trust patterns.

| Screen | Purpose / layout / data | Notable states and trust |
|---|---|---|
| Data freshness (`/data-freshness`, F-209) | Table of sources: latest vintage, last success, cadence, status. Admins see run links. | E: no sources. St/failed shown as text + icon. |
| County detail (`/need-map/:fips`) | Full indicator list, trend by vintage, "add to packet". | NP per indicator. |
| Methodology (`/methodology`) | Need-score inputs, weights, vintages, limits; M1–M6/O1 definitions; suppression rules; version history. | E: no approved version. |
| Metric detail (`/dashboard/metrics/:id`) | Distribution, breakdowns by county and referral source, definition. | S, Ag, zero-denominator: "Not enough closed episodes". |
| Outcomes (O1) | Mean change and share improved per measure, direction explained. | E until D-005 is decided. S. |
| Cases list + case record | Table (opaque IDs) → record tabs: application, authorization, delivery, outcome. | Exact dates (staff only). Admin-only delete via alert-dialog. Unsaved guard. |
| Manual entry forms ×5 (F-302) | Single-column forms, max 640px, with validation shared with upload. | No notes fields. Errors inline. Audit toast. |
| Aggregate submissions (F-303) | Period + metric + value + n. | Σ Aggregate badge everywhere. Duplicate-period warning. |
| Providers | List/edit with the affiliated flag. | M6 dependency explained. |
| Batch history + rollback | Batches with rows ok/error and creator. | Rolled-back state. alert-dialog "Roll back batch". |
| Packet builder (`/packets/new`, F-403/404) | Variant (board / grant by county / statewide) → checks → preview → PDF/DOCX/CSV. | Job L/Er states. Suppression + sources + M6 auto-included. Unapproved drafts excluded. |
| Packets / export history | Past packets, who made them, suppression_applied. | Board sees board packets only. |
| Admin: overview, users & roles (invite), org settings (UEI, budget, years operating, audit, retention), sources & ingest runs, need-score weights (versioned), audit log | Admin-only; dense tables; sheet for detail. | PD for non-admins. Failed run with error text. Weights must sum. |

### P2 — later (Phase 5 grants)

**P2-1 Grant matches + "How we matched"** (`/grants`, F-501–504). Mockup: `mockups/p2-grant-matches.png`

| | |
|---|---|
| Purpose | Find fundable opportunities fast and trust why each one was ranked. |
| Layout | Header (count, digest threshold), filters, list (fit score, title, funder/source, close date, range, eligibility flag badges, pipeline status). A sticky right panel: score, 6 components each with points/weight, a bar, the reason and a [source] link; an eligibility checklist; an award-history summary with "full winning applications are not public"; actions (Move to Pursuing, Request strategy draft, Pass). |
| Data | opportunity, match_result.components/flags, org settings, award_history summary. |
| States | E: "No matches above 60 this week". L: list skeleton. Er: "Grants.gov refresh failed Oct 10, showing Oct 9 results". PD: board → 403. St: API-key and refresh line in the footer. |
| Trust | The panel renders only stored reasons + source_refs (no free-text summary). Flags show as text + icon (✓ ! ✕ ?). Component scores sum to the total. |
| A11y | List items are links; the panel updates with `aria-live="polite"`; bars have text values. |

**Other P2 screens:**

| Screen | Notes |
|---|---|
| Opportunity detail | Full text with matched phrases highlighted, criteria table, award history tab. |
| Pipeline | Columns or list: new → reviewing → pursuing → submitted → awarded/declined/passed; owner, deadline, notes; overdue/closing-soon with text. |
| Foundation opportunity form + CSV import | Same mapping pattern as the upload wizard. |
| Award history / funder profile | USAspending + 990-PF; data year and gaps; "applications not public". |
| Strategy builder + review | DRAFT banner; criteria map; numbered citations open the provenance sheet; inferences section kept separate; Approve/Reject alert-dialog; export locked until approved; validator-failure error state. |
| Weekly digest email | Plain HTML, the top 5 matches with score + one reason each, link to the app; created inactive (George activates). |

### P3 — later still

- Nightly audit reports (GREEN/YELLOW/RED as text + icon).
- Account/profile.
- Dark-mode QA.
- Org switcher: removed from the UI (FAS-only product). The `org_id` data model stays.
- Mobile-optimized intake (if decided).
- Retention/deletion request UI.
- Onboarding tour for new board members.

---

## 5. Design phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 now** | Tokens → base components → app shell + role redirect → login + reset/invite → 403/404/error → trust component kit → board home | All roles land on a real home. No raw errors. axe-core clean. e2e `auth-roles.spec.ts` green. Each PR ≤ 400 lines. |
| **P1 next** | Freshness, need map + county + methodology, upload wizard (all 5 steps), entry forms, aggregates, team dashboard, board print view, packet builder, admin core | Board packet produced in under 10 minutes in a usability test with synthetic data. Every number has a footer. Suppression QA passes. |
| **P2 later** | Matches + How we matched, pipeline, foundation import, award history, strategy builder, digest | 5 drafts reviewed with every number cited. Staff can move a match to an approved draft without help. |
| **P3 later still** | Nightly audits UI, profile, dark mode, mobile intake, retention | As decided |

If George picks the **deck's order**, swap in P1: need map + methodology + freshness + digest first, then intake and dashboards. P0 stays the same either way.

---

## 6. Design decisions (made under George's direction: designer makes the call; George has final say)

| # | Decision | Call | Reasoning |
|---|---|---|---|
| 1 | Design order | **P0 shell first, then the need map, freshness and methodology; intake and dashboards in parallel; grants after** | The need map uses public data only, so it carries no privacy risk. It is the deck's "earliest win" and proves the trust patterns (source, as-of, not published) before any FAS data appears. Intake must exist before dashboards can show real numbers. |
| 2 | Devices | **Desktop first (1440), responsive tablet (768–1100: sidebar collapses to a 56px icon rail, grids become 2-up, the map's detail panel moves below), print for board views. No dedicated phone intake in v1.** | Staff work in spreadsheets on desktops. The board reads on paper or tablets. Phone data entry of case dates is error-prone; revisit after research. |
| 3 | Board access | **Board members get logins (read-only home + packets), and every packet is also downloadable/printable so staff can email it** | Logins give audit, always-current "as of" dates and no stale attachments. The print sheet covers members who never log in. Invite + set-password is therefore P0. |
| 4 | Staff sub-roles | **Keep one `staff` role in v1. Design actions so permissions can split later (approve draft, export, delete are separate, named buttons).** | The team is small, and the PRD and RLS already use one role. Splitting now adds RLS work with no evidence of need. |
| 5 | Branding | **FAS Evidence, a Family Advocacy Services product. No CasePilot branding anywhere users see it (screens, login, page titles, emails, packets). Type-only wordmark: "FAS" in Source Serif 4 Bold, a 1.5px forest-green rule, then "EVIDENCE" in Inter SemiBold caps with 0.2em tracking, in forest green. "Family Advocacy Services" sits under it. Palette: parchment + forest green; Inter for UI, Source Serif 4 for display. No purple, no gradients.** | George's call: the product is strictly FAS's. The serif "FAS" echoes the annual-report tone of board packets. The tracked sans caps give "Evidence" a quiet, institutional label. With no icon, it can't look like a generic logo, and it prints cleanly in one color. The name sits in one variable (`BRAND_NAME` in `mockups/src/gen.py`), so a rename is a one-line change. |
| 6 | Icons | **Text-first navigation with no decorative icon grid; glyphs only where they carry status meaning (✓ ! ✕ ◷ —)** | Status needs a non-color cue; decoration doesn't. This keeps the UI from looking generic. |
| 7 | Map form | **Real county geometry in production, with a tile cartogram as the tablet/fallback and the always-available table view** | Small rural counties disappear on a geographic map, and the tiles keep all 29 legible and clickable. |
| 8 | Visual quality bar | Real data visuals only (sparklines, share bars, the map, tables). Every number has a source footer. No filler copy. Whitespace on an 8px rhythm. | Matches the "easy to understand at a glance" requirement. |

**Still needs George or FAS (not design calls):**
- D-005 outcome surveys (sets the O1 screens).
- Approving the sister-clinic disclosure wording and the conflict-of-interest policy.
- Sequencing the board data path: RLS currently blocks board accounts from FAS tables, so suppressed views or an aggregate API are needed.
- Approving 3 short research sessions (director, case manager, board member) before the P1 build.

## 7. Mockup files

All at 1440px wide, synthetic data. HTML sources are in `mockups/src/` and use the design-system tokens, Inter and Source Serif 4.

| Phase | Mockup |
|---|---|
| P0 | `p0-login.png` |
| P0 | `p0-staff-home.png` |
| P0 | `p0-403.png` |
| P0 | `p0-board-home.png` |
| P1 | `p1-team-dashboard.png` |
| P1 | `p1-board-dashboard.png` |
| P1 | `p1-upload-mapping.png` |
| P1 | `p1-county-map.png` |
| P2 | `p2-grant-matches.png` |
