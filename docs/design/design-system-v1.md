# FAS Evidence Design System v1 — Proposal

*Status: Draft for George's review · 2026-10-10 · Scope: FAS Evidence, a Family Advocacy Services product ("Public Data to Proof"), web app on Next.js + shadcn/ui*

## 1. Context

**What the product is (from repo docs).** Per `docs/ARCHITECTURE.md` and `harness/feature_list.json`, FAS Evidence is a data and proof platform for a family-services org (FAS). It shows Utah county public indicators, a need score and map, FAS case/outcome metrics with small-cell suppression, team and board dashboards, PDF/DOCX packets, and grant matching with cited AI strategy drafts. There are three roles: **admin**, **staff** and **board_viewer** (F-101). Two principles shape the design: "every displayed number is a query result with provenance" and "privacy by construction." So the UI has to make **numbers, sources and suppression states** easy to read and trustworthy. That matters more than decoration.

**What the current preview looks like** (deployment `fas-caspilot-data-4gc0mu3ue-aimoggas-projects.vercel.app`, READY preview in Vercel team *aimoggas-projects*, plus source at `main`):
- **Fonts:** a serif stack across the whole UI (`Georgia, "Iowan Old Style", "Palatino Linotype", serif`). No web font is loaded and there is no mono font.
- **Colors** (`app/globals.css`, raw hex, not shadcn tokens): parchment background `#f4f1ea`, near-black warm text `#1c1915`, panel `#fffdf8`, line `#d9d1c3`, deep forest green accent `#1f4d3a` (also used as "ok"), oxblood "bad" `#8c2f2f`, muted `#5c564c`. No dark mode.
- **Login (`app/login/page.tsx`):** unstyled native `<form>` with an `<h1>Sign In</h1>`, bare labels and inputs, a native button, and the error as a plain `<p>`. The prerendered HTML shows only the Suspense fallback "Loading...". There's no brand mark, card, or focus styling.
- **Role shell (`components/PageLayout.tsx`):** a centered 800px column with inline styles (`margin: 50px auto; padding: 20px`), a page `<h1>`, "Role: **staff**", and a native "Sign Out" button. No nav, header, or sidebar.
- **Spacing/radius/shadows:** ad hoc inline values. No scale, no radius, no shadows.
- **Components:** none from shadcn/ui yet, even though ARCHITECTURE.md names shadcn/ui.

**Takeaway.** The existing warm-parchment + forest-green + oxblood palette already reads as calm, institutional and trustworthy, like a law library or a good annual report. v1 **keeps that identity** and makes it systematic. It moves the palette into shadcn tokens (oklch) with a dark mode, switches UI text to a highly legible sans with serif kept for display, and adds a real role shell and components.

## 2. Design principles
1. **Calm over loud.** One accent hue (forest green). Lots of neutral warm surfaces. Color carries meaning, not decoration.
2. **Numbers are the hero.** Tabular figures, a clear hierarchy, and source and vintage always one glance away.
3. **Show the guardrails.** Suppressed cells, draft vs. approved AI output, and the data freshness of each view are first-class states with their own visuals.
4. **Board-ready by default.** Every view should print and export cleanly (Phase 4 board view "prints cleanly").
5. **Accessible is non-negotiable.** WCAG 2.2 AA minimum. All token pairs below are verified.

## 2a. Brand and wordmark
- **Name:** FAS Evidence, a Family Advocacy Services product. No CasePilot branding anywhere users see it.
- **Wordmark (type only):** "FAS" in Source Serif 4 Bold (22px in the sidebar), a 1.5×18px `--primary` vertical rule, then "EVIDENCE" in Inter SemiBold 11.5px, uppercase, 0.2em tracking, in `--primary`. "Family Advocacy Services" sits beneath it in `text-xs muted`.
- **On tablet** (sidebar rail), only "FAS" shows.
- **In print and packets:** one color (foreground).
- **Clear space:** the cap height of "FAS" on all sides.
- **Don'ts:** no icon or monogram tile, no gradients, never typeset "Evidence" in serif.
- **Page titles:** `<page> · FAS Evidence`.

## 3. Typography
| Role | Family | Notes |
|---|---|---|
| UI / body | **Inter** (via `next/font/google`, variable) | Neutral and very legible at small sizes in data tables. Enable `font-feature-settings: "cv11","ss01"`. |
| Display / headings H1–H2, board packets | **Source Serif 4** (variable) | Keeps the current serif character but is screen-optimized and has better weights than Georgia. |
| Numbers | Inter with `font-variant-numeric: tabular-nums` | All metrics, tables and currency. |
| Code / IDs / FIPS | **JetBrains Mono** | ingest_run IDs, source IDs. |

**Type scale** (1.200 minor third, 16px base, rem):
| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `text-display` | 2.488rem / 1.15 (serif) | 600 | Board cover, login headline |
| `text-h1` | 2.074rem / 1.2 (serif) | 600 | Page title |
| `text-h2` | 1.728rem / 1.25 (serif) | 600 | Section |
| `text-h3` | 1.44rem / 1.3 (sans) | 600 | Card title |
| `text-h4` | 1.2rem / 1.4 (sans) | 600 | Sub-section |
| `text-base` | 1rem / 1.6 | 400 | Body |
| `text-sm` | 0.875rem / 1.5 | 400/500 | Tables, form labels, UI |
| `text-xs` | 0.75rem / 1.4 | 500 | Captions, source/vintage tags (uppercase +0.04em tracking) |
| `text-metric` | 2.25rem / 1.1 tabular | 600 | KPI cards |

Max line length is 72ch for prose. Letter-spacing is -0.01em on headings 1.44rem and up.

## 4. Color tokens (shadcn/ui, Tailwind v4, oklch)
These are derived from the current hex values: `#f4f1ea` → oklch(0.959 0.01 87.5), `#1f4d3a` → oklch(0.382 0.061 164), `#8c2f2f` → oklch(0.443 0.127 23.9).

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.5rem;

  /* Neutral — warm "parchment" ramp */
  --background: oklch(0.975 0.008 85);
  --foreground: oklch(0.22 0.012 70);
  --card: oklch(0.995 0.004 85);
  --card-foreground: oklch(0.22 0.012 70);
  --popover: oklch(0.995 0.004 85);
  --popover-foreground: oklch(0.22 0.012 70);
  --muted: oklch(0.945 0.010 85);
  --muted-foreground: oklch(0.48 0.015 70);
  --secondary: oklch(0.935 0.012 85);
  --secondary-foreground: oklch(0.26 0.012 70);
  --accent: oklch(0.935 0.020 160);         /* green-tinted hover surface */
  --accent-foreground: oklch(0.30 0.05 160);
  --border: oklch(0.89 0.012 80);
  --input: oklch(0.60 0.014 80);            /* stronger than border for form affordance */
  --ring: oklch(0.50 0.07 160);

  /* Primary — FAS Evidence forest green */
  --primary: oklch(0.38 0.06 160);
  --primary-foreground: oklch(0.98 0.008 85);

  /* Semantic */
  --destructive: oklch(0.48 0.15 25);       /* oxblood, from current --bad */
  --destructive-foreground: oklch(0.98 0.008 85);
  --success: oklch(0.45 0.09 155);
  --success-foreground: oklch(0.98 0.008 85);
  --warning: oklch(0.50 0.11 70);           /* amber-ochre text tone */
  --warning-foreground: oklch(0.98 0.008 85);
  --info: oklch(0.47 0.09 245);             /* slate blue */
  --info-foreground: oklch(0.98 0.008 85);
  /* Soft backgrounds for badges/alerts */
  --success-soft: oklch(0.95 0.03 155);
  --warning-soft: oklch(0.96 0.04 85);
  --destructive-soft: oklch(0.95 0.03 25);
  --info-soft: oklch(0.95 0.025 245);
  --suppressed: oklch(0.93 0.008 80);       /* hatched cell fill for n<11 */

  /* Charts (colorblind-safe order, map ramp uses chart-1 light→dark) */
  --chart-1: oklch(0.38 0.06 160);
  --chart-2: oklch(0.55 0.09 245);
  --chart-3: oklch(0.65 0.11 75);
  --chart-4: oklch(0.50 0.12 25);
  --chart-5: oklch(0.55 0.03 70);

  /* Sidebar (role shell) */
  --sidebar: oklch(0.955 0.010 85);
  --sidebar-foreground: oklch(0.26 0.012 70);
  --sidebar-primary: oklch(0.38 0.06 160);
  --sidebar-primary-foreground: oklch(0.98 0.008 85);
  --sidebar-accent: oklch(0.925 0.016 120);
  --sidebar-accent-foreground: oklch(0.22 0.012 70);
  --sidebar-border: oklch(0.89 0.012 80);
  --sidebar-ring: oklch(0.50 0.07 160);
}

.dark {
  --background: oklch(0.18 0.008 70);
  --foreground: oklch(0.94 0.008 85);
  --card: oklch(0.215 0.008 70);
  --card-foreground: oklch(0.94 0.008 85);
  --popover: oklch(0.235 0.008 70);
  --popover-foreground: oklch(0.94 0.008 85);
  --muted: oklch(0.25 0.008 70);
  --muted-foreground: oklch(0.70 0.012 80);
  --secondary: oklch(0.27 0.008 70);
  --secondary-foreground: oklch(0.94 0.008 85);
  --accent: oklch(0.28 0.025 160);
  --accent-foreground: oklch(0.90 0.04 160);
  --border: oklch(0.30 0.008 70);
  --input: oklch(0.55 0.010 70);
  --ring: oklch(0.70 0.08 160);

  --primary: oklch(0.76 0.08 160);
  --primary-foreground: oklch(0.20 0.03 160);

  --destructive: oklch(0.70 0.15 25);
  --destructive-foreground: oklch(0.18 0.02 25);
  --success: oklch(0.74 0.11 155);
  --success-foreground: oklch(0.18 0.02 155);
  --warning: oklch(0.80 0.12 80);
  --warning-foreground: oklch(0.20 0.03 80);
  --info: oklch(0.74 0.09 245);
  --info-foreground: oklch(0.18 0.02 245);
  --success-soft: oklch(0.26 0.04 155);
  --warning-soft: oklch(0.27 0.04 80);
  --destructive-soft: oklch(0.26 0.05 25);
  --info-soft: oklch(0.26 0.04 245);
  --suppressed: oklch(0.25 0.006 70);

  --chart-1: oklch(0.72 0.09 160);
  --chart-2: oklch(0.72 0.09 245);
  --chart-3: oklch(0.80 0.11 80);
  --chart-4: oklch(0.70 0.13 25);
  --chart-5: oklch(0.68 0.02 70);

  --sidebar: oklch(0.16 0.008 70);
  --sidebar-foreground: oklch(0.90 0.008 85);
  --sidebar-primary: oklch(0.76 0.08 160);
  --sidebar-primary-foreground: oklch(0.20 0.03 160);
  --sidebar-accent: oklch(0.25 0.015 120);
  --sidebar-accent-foreground: oklch(0.94 0.008 85);
  --sidebar-border: oklch(0.28 0.008 70);
  --sidebar-ring: oklch(0.70 0.08 160);
}

@theme inline {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-source-serif), Georgia, serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card); --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover); --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary); --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent); --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive); --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success); --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning); --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info); --color-info-foreground: var(--info-foreground);
  --color-border: var(--border); --color-input: var(--input); --color-ring: var(--ring);
  --color-chart-1: var(--chart-1); --color-chart-2: var(--chart-2); --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4); --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar); --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary); --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent); --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border); --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

### Verified contrast (WCAG 2.1, computed)
| Pair | Light | Dark |
|---|---|---|
| foreground / background | 16.1:1 | 15.8:1 |
| muted-foreground / background | 6.1:1 | 7.0:1 |
| primary / background (links) | 9.0:1 | 9.1:1 |
| primary-foreground / primary (buttons) | 9.2:1 | 8.7:1 |
| destructive / card | 7.0:1 | 6.1:1 |
| success / card | 7.0:1 | 8.0:1 |
| warning / card | 6.1:1 | 9.3:1 |
| info / card | 6.7:1 | 7.7:1 |
| ring / background (focus, needs 3:1) | 5.4:1 | 7.3:1 |
| input / background (form boundary, needs 3:1) | 3.7:1 (`oklch(0.60 0.014 80)`) | 3.9:1 (`oklch(0.55 0.010 70)`) |
| input / card (popover in dark) | 3.9:1 | 3.4:1 |
| border / background | 1.3:1 (decorative only) | 1.4:1 |

Every text pair passes AA (4.5:1). `--border` is decorative. Form-control boundaries use `--input`, which meets WCAG 1.4.11 (≥ 3:1) on background, card and popover in both themes.

## 5. Radius, spacing, shadows, motion
- **Radius:** base `--radius: 0.5rem` (8px). Inputs and buttons use `md` (6px), cards and dialogs `lg` (8px), sheets and large panels `xl` (12px), badges full pill. Restrained, not bubbly.
- **Spacing:** Tailwind 4px base. Use only 1, 2, 3, 4, 6, 8, 12, 16 (4–64px). Page gutters are 16px on mobile (< 768, never less), 24px on tablet and 32px on desktop. Card padding is 24px. Table cell padding is 12px × 16px. Gaps between form fields are 16px and between sections 32–48px. The content max width is 1200px (a container width, not a breakpoint). Breakpoints: mobile < 768, tablet 768–1023 (56px rail), desktop ≥ 1024 (256px sidebar). Prose and forms are max 640px.
- **Density:** default comfortable. A `data-density="compact"` table variant (row height 36px vs 44px) is for staff power views.
- **Shadows** (warm-tinted, low):
  - `--shadow-xs: 0 1px 2px oklch(0.22 0.012 70 / 0.05)` for inputs and buttons
  - `--shadow-sm: 0 1px 3px oklch(0.22 0.012 70 / 0.08), 0 1px 2px oklch(0.22 0.012 70 / 0.04)` for cards
  - `--shadow-md: 0 4px 12px oklch(0.22 0.012 70 / 0.08)` for popovers and dropdowns
  - `--shadow-lg: 0 12px 32px oklch(0.22 0.012 70 / 0.12)` for dialogs and sheets
  - In dark mode, rely on surface lightness steps and borders and drop shadows to `xs`.
- **Motion:** `--ease-out: cubic-bezier(0.2, 0, 0, 1)`. Durations are 120ms (hover/press), 180ms (popover, tooltip, accordion) and 240ms (dialog, sheet). Use fade plus 4px translate only, with no bounce or scale over 0.98. Honor `prefers-reduced-motion` by turning transitions into opacity-only or none. Skeleton shimmer is off under reduced motion.

## 6. Component guidelines (shadcn/ui)
**Buttons** (`button`): variants are `default` (primary green, one per view region), `secondary`, `outline`, `ghost` and `destructive`, plus `link`. Every button is 44px tall below 1024px. `sm` (32px) and `default` (40px) apply only at ≥ 1024px via responsive classes (`h-11 lg:h-8`, `h-11 lg:h-10`); `lg` is 44px everywhere. Labels are sentence case with verb first ("Export packet"). Loading state uses an inline spinner and keeps the width. The disabled state is 50% opacity plus `aria-disabled`, with no hover. Don't put two primary buttons side by side.

**Inputs & forms** (`input`, `label`, `select`, `textarea`, `form` with react-hook-form + zod): labels always sit above a full-width field, never as placeholder-only labels. Input text is at least 16px (`--input-font`) at every width, and inputs are at least 44px tall (48px on mobile login). Helper text is `text-sm muted-foreground`. Errors appear inline under the field in `destructive` with an icon and are tied by `aria-describedby`. On submit, focus moves to the first invalid field. Mark the required field type, or mark optional fields "(optional)" — this proposal recommends marking optional, because most FAS forms are mostly required. Number fields are right-aligned with tabular nums. Upload (F-301) uses a dashed `--input` dropzone with the mapping preview in a table.

**Cards** (`card`): `bg-card`, 1px border, `shadow-sm`, radius lg. KPI card layout: label (`text-sm muted`), metric (`text-metric`), delta badge, then a footer line **"Source · vintage · n"** in `text-xs`. A provenance popover opens from that footer and shows source_id, ingest_run, and last_success_at.

**Tables** (`table` + TanStack data-table): sticky header on `bg-muted`, with `text-xs` uppercase header labels. Numeric columns are right-aligned and tabular. Zebra striping is off; rows get a hover on `accent`. **Suppressed cells** show "—" on `--suppressed` with a diagonal hatch and a tooltip: "Suppressed (n < 11) to protect privacy." Never use blank or 0. Pagination is at the bottom right, with 25 rows by default.

**Nav / role shell** (`sidebar`, `breadcrumb`, `dropdown-menu`, `avatar`): replaces the current centered 800px `PageLayout`.
- A left sidebar (collapsible to icons, 256px or 56px) holds the FAS Evidence wordmark with "Family Advocacy Services" beneath it, and nav grouped by role. There is no org switcher; the product is FAS-only and `org_id` stays in the data model.
- A top bar holds the breadcrumbs, a global data-freshness indicator ("Public data updated 2 days ago"), and a user menu with name, role badge, theme toggle and Sign out.
- Nav items are filtered by role. **board_viewer** gets a simplified read-only nav (Board dashboard, Packets) and a subtle "Read-only" badge. **admin** gets an extra "Admin" group (Sources, Ingest runs, Users, Audit log).
- The active item is `sidebar-accent` with a 2px primary left indicator.

**Dialogs** (`dialog`, `alert-dialog`, `sheet`): use `alert-dialog` for destructive or irreversible actions (approve strategy draft, delete upload batch) and name the action in the button ("Delete batch"), never "OK". Use `sheet` (right, 480px) for record detail and provenance. Focus is trapped and Esc closes, except for alert-dialog with pending changes. Max width is 560px.

**Toasts** (`sonner`): bottom right, max 3, 5s, pause on hover. Use them for confirmation only ("Export queued"). Errors that need action go in an inline `alert`, not a toast. Exports show a persistent toast with progress and a link when ready. Announce through `aria-live="polite"`.

**Empty states:** centered within the region, with a 40px muted line icon, a `text-h4` title, one sentence of explanation and one primary action. Examples: "No uploads yet · Upload your first case file." and "No matching grants this week." Use distinct states for *no data*, *suppressed*, *no permission* and *error*, and always say why.

**Auth / login** (`card`, `input`, `button`, `alert`): replaces the current unstyled form.
- Split layout on lg screens. Left: a form card (max 400px) with wordmark, H1 "Sign in to FAS Evidence" (serif), email, password with a show/hide toggle, and a full-width lg primary button with "Signing in…" loading text.
- Errors use a destructive `alert` above the button, with a generic message ("Email or password is incorrect"). Don't show raw Supabase messages.
- Right panel on lg: a calm `--sidebar` surface with a one-line value statement ("Public data to proof.") and the privacy note "Protected data. Access is logged."
- On mobile, show a single centered card.
- The Suspense fallback is a skeleton card, not the "Loading..." text.
- A config error state uses an `alert`, not raw text.

**Also standardize:** `badge` (status: draft / approved / rejected; freshness: fresh / stale / failed using the soft semantic backgrounds), `tooltip`, `tabs`, `skeleton`, `chart` (shadcn chart with `--chart-*`), `alert`.

**AI drafts:** any LLM output sits in a card with an "AI draft — needs review" info badge. Citations are numbered superscript links to their sources, and the "Approve" action is gated behind alert-dialog.

## 7. Accessibility notes
- WCAG 2.2 AA target. All text token pairs above measure at least 4.5:1, and focus ring contrast is at least 3:1 in both themes.
- Visible focus: `outline-none ring-2 ring-ring ring-offset-2 ring-offset-background` on every interactive element, shown only for keyboard focus (`:focus-visible`).
- Never use color alone. Status badges carry an icon and a label. Chart series get direct labels or patterns. The map legend has numeric bins.
- Every tappable control is at least 44×44px on mobile and tablet (< 1024px), with no exceptions. At ≥ 1024px, 32/40px button sizes are allowed.
- Use semantic landmarks (`header`, `nav`, `main`) and a "Skip to content" link in the shell.
- Tables use `<th scope>`. Sortable headers announce `aria-sort`.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`, and let users override the theme in the user menu.
- Text must reflow at 200% zoom and 320px width. Wide tables scroll inside their own container.
- Print stylesheet for board views: light theme forced, the sidebar hidden, source footers kept.

## 8. Live preview validation (2026-10-10, 2:25 PM MT)
I checked preview `fas-caspilot-data-m561u3afy-aimoggas-projects.vercel.app` (the F-101 QA preview) with a temporary Vercel share link. I signed in with the synthetic fas-dev admin, staff and board_viewer test accounts.

Screenshots are in `docs/design/reviews/live/`: `live-login.png`, `live-shell-admin.png`, `live-shell-staff.png`, `live-shell-board.png`, `live-board-blocked-staff.png`.

| Area | Seen live | Versus draft |
|---|---|---|
| Global type & color | Body text is Georgia serif, background rgb(244,241,234) = `#f4f1ea`, text `#1c1915`. | **Confirmed.** The palette basis for the tokens is correct. |
| Form controls | Inputs and buttons use browser defaults: Arial, 21px-high inputs with a 2px inset grey border and 0 radius. The button is grey `#efefef` with an outset border and 1×6px padding. | Worse than the code suggested, because the serif body doesn't reach the controls. The draft's 44px inputs and buttons, `--input` border, 6px radius and Inter everywhere fix this. Add the shadcn base layer `button,input{font:inherit}`. |
| Login layout | `Sign In` H1 at 32px. Label, field, label, field and button run **inline on one row**, flush to the left edge (0 margin). No card, brand or helper text. | Confirms that §6 auth/login is the top priority. Add: labels stacked above fields (draft rule), a max-width 400px card, and a centered layout. |
| Post-login landing (all roles) | Every role lands on `/`, which shows a "LOCAL DEVELOPMENT" dev placeholder (the repo copy still says "CasePilot × FAS"; replace it with FAS Evidence) with "Check local services" and Sign Out. There is no role-aware home. | **New finding.** The shell must route each role to its home (admin → /admin, staff → /staff, board_viewer → /board), or show a role-aware dashboard. Remove the "local development" banner from preview/prod, or turn it into an environment badge in the top bar. |
| Role pages | `/admin`, `/staff`, `/board` are identical. Each has an H1 ("Admin Page" and so on), "Role: X", one access sentence and a native Sign Out button in a centered 800px column. There's no nav, so a user can only reach other pages by URL. | Confirms the draft's sidebar shell recommendation. The role badge belongs in the user menu, not the page body. |
| Forbidden state | board_viewer opening `/staff` gets a bare "403 - Forbidden / Access denied." page. Guards work. | **New:** add a "No permission" empty state using §6: "You don't have access to Staff tools", a link back to the Board dashboard, and the user's role shown. |
| Vercel toolbar | A floating Vercel toolbar button sits at the right edge on previews. | Note for QA screenshots. It isn't part of the app. |

No change to the tokens was needed. The changes are to §6: stacked labels inside a login card, role-based post-login redirect, a 403 empty state, an environment badge, and `font: inherit` on form controls.

## 9. Reference examples
Public marketing pages, captured 2026-10-10. Images are in `docs/design/refs/`.

1. **Mercury: business banking** · https://mercury.com/ · `refs/mercury.png`. A calm, premium finance brand: soft neutrals, generous whitespace, one restrained accent, quiet sans typography and pill buttons. It shows how a money/compliance product earns trust through restraint, which is the tone we want for board viewers and for the login.
2. **Linear: product development system** · https://linear.app/ · `refs/linear.png`. The homepage shows the real app shell: a collapsible left sidebar grouped into sections (Workspace, Favorites), a quiet top bar, dense but readable lists, and an activity feed. It is the model for our role shell, the compact table density, and the dark mode built from surface lightness steps.
3. **Clio: legal practice management** · https://www.clio.com/ · `refs/clio.png`. A legal-ops leader. It uses deep navy, clear stats ("100+ bar approvals", "4.7/5"), and "Matter" and "Notification" cards with small uppercase labels. That is the same pattern as our KPI card plus "Source · vintage · n" footer, and it shows how legal buyers expect authority and credibility. We take its label/metric hierarchy but keep our warm green rather than its corporate blue.

## 10. Rollout (proposed)
1. Run `npx shadcn@latest init`, replace `globals.css` with the tokens above, and load fonts via `next/font`.
2. Add the components: button, input, label, form, card, table, sidebar, dialog, alert-dialog, sheet, sonner, badge, alert, skeleton, tooltip, dropdown-menu, breadcrumb, avatar, tabs, chart.
3. Rebuild `/login` and `PageLayout` → `AppShell`, add the role-based post-login redirect and a styled 403 state, and keep e2e `auth-roles.spec.ts` green.
4. Add an axe-core check to QA_ACCEPTANCE for UI features.
