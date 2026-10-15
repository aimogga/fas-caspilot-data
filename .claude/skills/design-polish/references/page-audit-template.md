# Page audit: <route> · packet DS-<id><letter> · role <role>

Fill every table before writing code. Paste the finished audit into the spec's "Audit" section.

## Context
- Mockup: `docs/design/mockups/<file>.png` (or "none; screen plan §4 row <name>")
- Screen plan row: `docs/design/fas-screen-plan-part2.md` §4 <name>
- Existing spec: `docs/design/specs/DS-<n>.md`
- Current code: list the page and components
- Before shots: `docs/design/reviews/DS-<id>/before/` (or "CI artifact")

## Numbers inventory (one row per number, chart point series, badge, chip, cell group)
| Element (data-slot or text) | Has hover card? | Term id | Source shown? | As-of shown? | Hidden reason wired? | Action |
|---|---|---|---|---|---|---|
| | | | | | | |

## Controls under 44 px below 1024
| Control | Measured size at 375 | Fix |
|---|---|---|

## Layout
| Width | Horizontal scroll? | h1 left / content width (layout-parity) | Reading order = visual order? | Notes |
|---|---|---|---|---|
| 375 | | | | |
| 1024 | | | | |
| 1440 | | | | |

## States present
| State | Exists? | Copy | Fix |
|---|---|---|---|
| Empty | | | |
| Loading (skeleton) | | | |
| Error (plain + reference id + retry) | | | |
| Permission denied | | | |
| Print (if board/packet) | | | |

## Accessibility (axe + manual)
| Finding | Impact | Fix |
|---|---|---|

## Copy faults (codes, jargon, bare deltas, unexplained "—")
| Text | Where | Replacement |
|---|---|---|

## Tokens and styling faults (raw hex/px, inline colours, off-scale spacing)
| Finding | File:line | Fix |
|---|---|---|

## Mockup gaps (what the mockup shows that the page does not)
| Mockup element | In this sub-packet? | Packet |
|---|---|---|

## Estimate
- Hand-written lines (added + deleted, excluding markdown and generated): <n>
- Split: a = …, b = … (only if > 400)
