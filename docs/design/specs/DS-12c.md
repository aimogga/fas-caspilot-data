# DS-12c — Grant matches card at 1024 (`/staff/grants/matches`)
Source: QA note on #306 (F-504d), pre-existing on main. Builds on DS-12a (list) and DS-12b (panel). **Budget:** ≤ 400 hand-written lines (D-012).

## Audit (before, `docs/design/reviews/DS-12c/before/`)
| Width | Finding | Cause |
|---|---|---|
| 1024 | "Draft a response strategy" runs past the card's right edge | From `lg` the card is two columns (`auto 1fr`) inside a list column that is only ~295 px beside the 24rem aside, so the text column is ~150 px; `Button` is `whitespace-nowrap` |
| 1024 | Title, meta line and flag messages wrap every 2–3 words | Same ~150 px text column |
| 1024 | Long flag messages ("Award size not checked: the listing does not state an award range") become tall rounded pills; the glyph shrinks to a dot | `Badge` is `rounded-full` + `items-center`; the flag badge adds `whitespace-normal` but keeps both; the svg can shrink |
| 375, 1440 | No fault | 375 is one column; 1440 has room for two |

No number, hover card, term or data changes. Controls stay `size="sm"` (44 px below `lg`).

## Change
| Element | Before | After |
|---|---|---|
| Card grid | two columns from `lg` | a container query on the list (`@container` on `ol`): two columns only when the list is ≥ 42rem (`@2xl`) wide, so at 1440 it stays two-column, beside the 1024 aside it stacks (score tile and band badge in a row on top, text full width), and from 768 to 1023 (no aside) it is two-column. The theme defines only `md` and `lg`, so `xl:` would never apply |
| Score tile column | stacked from `lg` | stacked at `@2xl` |
| Flag badge | `rounded-full`, centred glyph | `rounded-md`, glyph on the first line (`items-start`, `mt-0.5`, `shrink-0`) |

## Tests
- Unit `lib/grants/match-list.test.tsx` "DS-12c: …": card classes and flag badge classes.
- e2e `tests/e2e/match-explanation.spec.ts`: at 375 and 1024 no button or badge in a card ends past the card's right edge (plus the existing no-scroll and axe checks).

## Evidence
`docs/design/reviews/DS-12c/`: before (main preview) and after (branch preview) at 375, 1024 and 1440, plus `-pass` at 1024 (a row with long flag messages, after Show more).
