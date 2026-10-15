---
name: design-polish
description: Polish one FAS Evidence page to the design bar. Audit, spec, implement under the 400-line cap, evidence at 375/1024/1440, draft PR. Use for any DS-xx packet, any "make this page clearer / look expensive / easier for non-data people", any hover or explain work, and whenever a number, chart, badge or table is added to a page.
argument-hint: <route or DS-id> [a|b]
---

# Design polish

One page, one sub-packet, one PR. The `designer` agent (`.claude/agents/designer.md`) runs this skill end to end; a person can run it too with `/design-polish /need-map a`.

## When to use
- A packet row in `docs/design/POLISH_PLAN.md`.
- A page that shows numbers without explaining them, or that reads as a form rather than a finished product.
- Any new number, chart, badge, chip or table: it must ship with its hover card, source and as-of.

## The one rule everything else serves
Every number, chart point, map county, badge and status chip shows, on pointer hover, on keyboard focus and on tap, a small card with: what it means in plain words, the source, the as-of date, and why a value is hidden. The same words also live in a footer or table so the card is never the only place. (George, 2026-10-15; D-040.)

## The kit (`components/trust/explain.tsx`, `lib/trust/glossary.ts`)
| Face | Use it for | Behaviour |
|---|---|---|
| `Hint text="…"` | One line: a badge, a chip, a status, a delta, a "—" | Tooltip on hover and focus; popover on click, tap or Enter; same string both ways |
| `ExplainCard term=… value source asOf hidden` | A rich card on a title, KPI, score, indicator | Hover card on pointer and focus; popover dialog on Enter, Space or tap; Esc returns focus; `icon` variant renders an Info button labelled "About <title>" |
| `Provenance` (inside `SourceFooter`) | Source · period · n · as of, plus source id, ingest run, vintage when supplied | Trigger is the footer text with a dotted underline |
| `ExplainBody` | The pure markup inside any face; reuse it in custom layers | Title, plain sentence, `dl` rows |
| `ExplainLayer` (DS-11a onward) | Many targets at once: table cells, map counties, bar segments | Descendants carry `data-term`, `data-value`, `data-source`, `data-asof`, `data-hidden`; one positioned card follows pointerover, focusin and click; Esc closes |

Terms live in `lib/trust/glossary.ts` (core: metrics, hidden reasons, freshness, need score). Domain terms live beside their domain (`lib/need-map/terms.ts`, `lib/grants/terms.ts`) so page packets never edit the shared file. Add a term before you reference it; its test enforces title, plain sentence and no product codes.

## Reuse before you write
- Layout: `Page`, `PageHeader`, `Stack`, `Cluster`, `Grid`, `Section`, `EmptyState`, `ErrorState`, `Skeleton`, `FormField`, `ResponsiveTable` (`components/layout/index.tsx`).
- Trust: `SourceFooter`, `SuppressedCell`, `FreshnessChip`, `NotPublished`, `DraftBanner`, `AggregateBadge` (`components/trust/index.tsx`).
- Charts: `ChartFrame` (eyebrow, serif headline, View as table, footer), `LineChart` + `LineHover`, `BarChart`, `Sparkline`, `PictureCards`; hover text helpers in `lib/charts/hover.ts` (`tooltipText`, `nearestIndex`, `stepIndex`).
- Words and dates: `asOfLabel`, `asOfNote`, `METRIC_CARDS`, `NOT_AVAILABLE` (`lib/dashboard/cards.ts`); `quarterLabel` (`lib/dashboard/filters.ts`); delta and band labels (`lib/dashboard/format.ts`); county sentences (`lib/need-map/compare.ts`); board sentences (`lib/board/summary.ts`).
- 44 px inline trigger precedent: `CHIP` in `components/freshness/AggregateFreshnessChip.tsx`.
- Icons: `lucide-react` only, and only where a glyph carries meaning.

## Commands
```
pnpm install --frozen-lockfile        # once per worktree
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e -- tests/e2e/<spec>.spec.ts   # needs local Supabase or CI; /ui needs none
pnpm gate                              # lint, typecheck, unit, secret scan, 400-line cap, 300-char lines, progress order
pnpm shots -- --id DS-10a --tag before --role staff --route /staff [--base <preview url>] [--hover "<sel>"] [--focus "<sel>"] [--print] [--dark]
pnpm review-page                       # rebuilds docs/design/reviews/index.html
```
The shots script signs in with `DESIGN_SHOTS_PASSWORD` from the environment (never committed, never printed). Shots go to `docs/design/reviews/<DS-id>/<before|after>/`; at most 12 PNGs per PR; full page only at 375.

## Shared-file rules
- Kit-only files, never edited by a page packet: `app/globals.css`, `components/trust/index.tsx`, `components/trust/explain.tsx`, `harness/generated-files.json`.
- `tests/e2e/layout-parity.spec.ts`: additions only (a new route's geometry rows).
- `harness/progress.md`: append once, last, after merging `origin/main` (`pnpm gate` enforces the order).
- Page-local CSS goes in a component-local file (precedent `components/board/print.css`), never in globals.

## Stop conditions
Stop and report instead of guessing when: a change needs a token, a schema, a migration, real data, an email or money; the estimate cannot fit 400 lines even split; a needed data field does not exist (ship without it, note it); CI is red twice after fixes; a file is already changed by an open PR.

## PR body skeleton
Use `.github/pull_request_template.md`. Packet line: `DS-<id> · Refs F-<feature>`. Add the before/after table from `references/pr-evidence.md`, the axe line, the gate's D-012 count, and the excluded files by name. Open as a draft; the supervisor merges on green CI.

## References
- `references/polish-bar.md`: the design bar as pass/fail rows.
- `references/plain-language.md`: how to write the words, approved wording, banned strings, the core term table.
- `references/page-audit-template.md`: the audit you fill before touching code.
- `references/pr-evidence.md`: shot naming, the PR evidence table, the CI-artifact fallback.
