# FAS design brief (for Claude Code)

Single entry point for UI work on FAS. Part 1 describes what exists in the repo today.
Part 2 lists George's design decisions (via the design team, 2026-10-12/13) as rules.
When the two conflict, Part 2 wins and the code should be changed to match.

## Part 1: what exists

### Tokens and CSS
- `app/globals.css` is the token source (Tailwind v4 via `postcss.config.mjs`; shadcn config in `components.json`).
- Colors are OKLCH CSS variables: `--background`, `--foreground`, `--card(-foreground)`, `--popover(-foreground)`,
  `--muted(-foreground)`, `--secondary(-foreground)`, `--accent(-foreground)`, `--border`, `--input`, `--ring`,
  `--primary(-foreground)`, `--destructive(-foreground)`.
- Status colors: `--success`, `--warning`, `--info` (each with `-foreground`), soft fills `--success-soft`,
  `--warning-soft`, `--destructive-soft`, `--info-soft`, and `--suppressed`.
- Sidebar: `--sidebar`, `--sidebar-foreground`, `--sidebar-primary(-foreground)`, `--sidebar-accent(-foreground)`,
  `--sidebar-border`, `--sidebar-ring`.
- Elevation and motion: `--shadow-xs|sm|md|lg`, `--ease-out`, `--duration-fast|md|lg` (120/180/240ms).
- Layout and touch: `--radius` (0.5rem), `--tap-min` (44px), `--input-font` (16px), `--page-gutter-mobile` (16px).
- Use these variables. Do not add new tokens without a design decision.

### Fonts
`app/layout.tsx` loads three `next/font/google` faces: Inter (`--font-inter`), Source Serif 4
(`--font-source-serif`), and JetBrains Mono (`--font-jetbrains`).

### Components
- shadcn primitives in `components/ui/`: `alert`, `badge`, `button`, `card`, `input`, `label`, `separator`, `sheet`.
- Layout primitives in `components/layout/index.tsx`, including `EmptyState` and `ErrorState`.
- App shell in `components/shell/`, with nav and breadcrumbs (`CRUMB`) in `lib/shell/nav.ts`.
- Status pages in `components/status/`. Trust UI in `components/trust/`.
- Feature components: `components/need-map/NeedTable.tsx`, `components/dashboard/M4Table.tsx`,
  `components/dashboard/MetricCard.tsx`. The dev gallery is at `app/(dev)/ui/page.tsx`.

### Pages
- `/need-map`: `app/(app)/need-map/page.tsx`, with logic in `lib/need-map/` (`query.ts`, `rank.ts`, `bins.ts`, tests).
- `/dashboard`: `app/(app)/dashboard/page.tsx`, with card logic in `lib/dashboard/cards.ts`.
- Score config table: `need_score_config (version, weights jsonb, approved_by)` in
  `supabase/migrations/20261009074829_f102_part1.sql`.

### Tests that enforce design
- `tests/e2e/layout-parity.spec.ts` checks Page layout geometry (375 px: left 16, width 343) and
  `scrollWidth` at 375/800/1024/1280/1440. Signed-in routes covered today: `/admin`, `/staff`, `/board`, `/403`.
- axe (`@axe-core/playwright`) runs in `map.spec.ts`, `shell.spec.ts`, `login.spec.ts`, `status-pages.spec.ts`, and `gallery.spec.ts`.
- `tests/e2e/map.spec.ts` asserts `scrollWidth === width` at 375 through 1440. `tests/e2e/tokens.spec.ts` checks the tokens.

### Existing design docs (read before large changes)
- `docs/DESIGN_WORKFLOW.md` (process and gates)
- `docs/design/design-system-v1.md`
- `docs/design/fas-screen-plan.md` and `docs/design/fas-screen-plan-part2.md`
- `docs/design/specs/DS-01a` through `DS-08`
- `docs/design/mockups/` (PNGs plus HTML sources, including `p1-county-map` and `p1-team-dashboard`) and `docs/design/refs/`

### Test logins
These synthetic accounts come from `supabase/seed.sql`: `admin@example.test` (admin), `staff@example.test` (staff),
and `board@example.test` (board_viewer). Get passwords from the seed or test fixtures. Never paste them into docs or PRs.

## Part 2: rules (George, 2026-10-12/13)

### General
1. Every UI change must pass at 375 px wide with no horizontal overflow and no text breaking mid-word.
2. axe must report 0 violations. Every new route needs `layout-parity.spec.ts` entries.
3. Empty or unavailable data shows a "Not available yet" style `EmptyState`, and failures show `ErrorState`.
   Never imply behavior the app doesn't have.
4. Use synthetic or public data only.
5. Numbers are right-aligned with tabular figures (`tabular-nums`) and carry labels and units.
6. Negative scores use a true minus sign (−, U+2212), never a hyphen.

### Need map (`/need-map`, F-211)
1. The board role sees all 29 Utah counties.
2. FAS counties get a 2px `var(--foreground)` outline on the map. The table and the detail view also show a
   "FAS county" text label (a badge column, using `components/ui/badge`).
3. The "Show FAS counties only" filter (`?fas=1`) is off by default and has its own empty state.
4. Color the map by need score in 5 equal-count bins (`lib/need-map/bins.ts`). Label the legend "placeholder"
   until George sets the final weights. Recheck which bin ties land in, and add tests for them.
5. Clicking a county shows its indicators, each with source and as-of date.
6. Column source notes stay short (source name + year). Put "as of" in the footer or a tooltip.
7. Commit the Census county outlines (about 60 KB) to the repo. Do not fetch them at runtime.
8. Unscored counties sort last and show "Not published".

### Need score
1. Weights are stored as fractions of 1 in `need_score_config.weights` and displayed as points out of 100.
2. v1: poverty 50, uninsured 50.
3. v2: poverty 30, child poverty 20, uninsured 30, single-parent 10, no-vehicle 10.

### Team dashboard (`/dashboard`, F-401)
1. Only admin and staff can open it. board_viewer gets a 403.
2. Cards with no data say "Not available yet".
3. Next work, in order:
   - Unhide it in the nav and add a breadcrumb (`lib/shell/nav.ts`, `CRUMB`).
   - Fix the M4 "Completed" header breaking mid-word at 375 px (`components/dashboard/M4Table.tsx`).
   - Add a header line, a freshness chip, and a filter bar that becomes a `sheet` on mobile.
   - Add the Freshness and Pipeline widgets.
   - Add `tests/e2e/team-dashboard.spec.ts` and `layout-parity.spec.ts` entries for `/dashboard` (and `/need-map`).

## Known gaps vs. the rules (as of this brief)
- `NeedTable.tsx` numeric columns are left-aligned below `md` (`text-left ... md:text-right!`). Rule 5 says right-aligned.
- No county outline geometry file is committed yet (need map rule 7).
- `layout-parity.spec.ts` does not cover `/need-map` or `/dashboard` yet.
- `team-dashboard.spec.ts` does not exist yet.
