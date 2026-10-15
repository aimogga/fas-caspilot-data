# The design bar (pass / fail rows)

Every row is checked at 375, 1024 and 1440 before a PR opens. "Fail" on any row means the packet is not done. Rows marked **(gate)** are also enforced by `pnpm gate` or CI.

## Hierarchy
| # | Requirement | How to check |
|---|---|---|
| H1 | Every card reads label → metric → source, top to bottom | Screenshot at 1024 |
| H2 | One serif headline in words per region ("Families waited 23 days for a first session"); never a bare metric name as the only heading | Read the page aloud |
| H3 | Metric numerals 32–40 px, tabular; labels 13–14 px; eyebrows 11–12 px uppercase with tracking | Inspect computed styles |
| H4 | Prose ≤ 72ch; content ≤ 1200 px; 8-px rhythm; card padding 24 px; 32–48 px between sections | Inspect |
| H5 | The page answers "what happened, how do we know, when" above the fold at 1024 | Read |

## Expensive = restraint
| # | Requirement | How to check |
|---|---|---|
| R1 | Tokens only: no raw hex, no arbitrary px outside the 4/8 scale, no inline colours **(review)** | `grep -n "#[0-9a-f]\{6\}\|style={{" <files>` |
| R2 | One accent (forest green); warm neutrals; status colours only for status, always with a glyph and a word | Screenshot |
| R3 | Cards: `bg-card`, 1 px border, `shadow-sm`; `shadow-md` only while interactive (hover/open) | Inspect |
| R4 | No gradients, no purple, no decorative icon grids, no illustrations, no emoji, no filler copy, no lorem | Screenshot |
| R5 | Motion 120/180/240 ms `--ease-out`, fade + 4 px only; opacity-only under `prefers-reduced-motion` | Toggle reduced motion |
| R6 | Icons from lucide only, only where a glyph carries meaning (status, navigation) | Grep imports |

## Plain language
| # | Requirement | How to check |
|---|---|---|
| P1 | No internal code reaches a user without the words beside it: M1–M6, O1, HPSA, PLACES, SAHIE, SAIPE, ACS, MOE, FIPS, pct, z-score | Grep rendered text |
| P2 | Every delta is an arrow plus words ("↓ 4 days faster than last quarter"), never a bare signed number | Read |
| P3 | Every "—", hatch or "Not published" is explained on hover and in the footer | Hover each |
| P4 | Sentence case; buttons start with a verb; a true minus sign (U+2212) for negatives | Grep |
| P5 | Dates in shared views are month or quarter only; as-of on every number | Read footers |

## Hover layer
| # | Requirement | How to check |
|---|---|---|
| X1 | Every number, chart point, map county, badge and status chip has a card: meaning, source, as-of, why hidden | Audit inventory, zero rows missing |
| X2 | Pointer hover, keyboard focus and tap show the same text | e2e: hover text == focus text == tap text |
| X3 | Esc closes and returns focus; a popover is `role="dialog"` labelled by its title | e2e |
| X4 | The words also exist outside the card (footer, table, caption) | Read |
| X5 | Many targets (tables, maps, bars) use one `ExplainLayer`, not one Radix root per cell | Code review |

## Guardrails visible
| # | Requirement | How to check |
|---|---|---|
| G1 | Suppressed (n < 11) and complementary-hidden cells use the one hatch + words; never 0, never blank | Screenshot |
| G2 | Not published is hatched with the words; never interpolated | Screenshot |
| G3 | Aggregate submissions carry the Σ badge; AI text carries the DRAFT banner | Read |
| G4 | Empty, loading (skeleton matching the layout), error (plain language + reference id + retry) and permission-denied states exist | Force each state |

## Accessibility (WCAG 2.2 AA)
| # | Requirement | How to check |
|---|---|---|
| A1 | axe 0 serious or critical **(gate: CI e2e)** | Spec |
| A2 | Every tappable control ≥ 44 × 44 px below 1024; 32/40 px allowed only ≥ 1024 via responsive classes | Measure |
| A3 | Visible 2 px focus ring on every interactive element | Tab through |
| A4 | Landmarks, skip link, `th scope`, `aria-sort` on sortable headers | Inspect |
| A5 | Charts: `role="img"` with a sentence label plus a "View as table" toggle; map has a table equivalent | Inspect |
| A6 | Text reflows at 320 px and 200 % zoom; no text under 12 px; inputs ≥ 16 px | Zoom |
| A7 | Status never by colour alone | Screenshot in greyscale |

## Responsive and print
| # | Requirement | How to check |
|---|---|---|
| V1 | No horizontal scroll at 375 (`scrollWidth` ≤ 375) **(gate: e2e)** | Spec |
| V2 | 375 top bar + sheet nav; 768–1023 icon rail; ≥ 1024 full sidebar; geometry rows in `layout-parity.spec.ts` for every route | Spec |
| V3 | Board and packet views print to Letter: shell hidden, one ink, footers kept, page numbers | Print emulation shot |

## Evidence
| # | Requirement | How to check |
|---|---|---|
| E1 | Before and after shots at 375, 1024, 1440 plus the packet's named variants (hover, focus, print, dark) | Files in `docs/design/reviews/<id>/` |
| E2 | PR body: criterion → test table, axe line, gate D-012 count, excluded files by name, mockup comparison | Read the PR |
| E3 | Hand-written diff ≤ 400 lines; no code line > 300 chars; progress entry last **(gate)** | `pnpm gate` |
