# Plain language

The reader is a board member who has never read a chart, or a case manager between calls. Every sentence should survive being read aloud at a board meeting.

## How to write "what it means"
1. Two sentences at most. The first says what the number is in everyday words. The second says how we count it or why it matters.
2. Name the unit and the period: "days", "families", "per hour", "this quarter", "the latest Census release".
3. Say the direction in words: "lower is better", "a higher score means more need relative to other counties".
4. Prefer "we" and "families" over "the organization" and "clients". Never "users".
5. No product codes, no acronyms without the words first, no jargon ("median" is allowed once it is explained: "the middle value, so one very long wait cannot skew it").

## Approved wording (use verbatim)
| Situation | Words |
|---|---|
| Suppressed count | "Fewer than 11 families, so the number is hidden to protect privacy." |
| Complementary suppression | "Hidden so the smaller group next to it cannot be worked out from the total." |
| Not published | "The source did not publish this for this county in that release." |
| Not available yet | "This number appears once the data behind it is set up." |
| Failed source run | "The last update from this source failed; we show the last good release and the date." |
| Stale source | "Overdue for a refresh: the last good update is older than the source's usual cycle." |
| As-of | "as of Oct 2026" (month and year in shared views; never a day for family data) |
| Delta, better | "↓ 4 days faster than last quarter" |
| Delta, worse | "↑ 2 days slower than last quarter" |
| No change | "Same as last quarter" |
| Relative score | "Relative ranking, not absolute need." |
| Example data | "Example" chip and "synthetic" in the footer |

## Banned strings in user-visible text
`N/A`, `null`, `undefined`, `NaN`, `error 500`, `CasePilot`, `pct`, bare `M1`…`M6`/`O1`, `MOE` alone, `FIPS` alone, `z-score` alone, `TBD`, `lorem`, exclamation marks, emoji.

## Core terms (mirrored from `lib/trust/glossary.ts`; the code file is the source of truth, change both)
| id | Title | Plain words |
|---|---|---|
| m1 | Days from court order to first session | How many days a family waited between the court order and their first therapy session. We report the median, the middle value, so one very long wait cannot skew it. |
| m2 | Days from application to funding decision | How many days passed between a family's application and FAS deciding whether to fund therapy. Median. |
| m3 | Approved but never started | Families whose therapy was approved but who had no session within 60 days. Lower is better. |
| m4 | Completion rate by income band | Of the families whose therapy closed, the share who finished the planned course, grouped by household income. |
| m5 | Cost per completed episode | What FAS paid, on average, for one completed course of therapy. |
| m6 | Where therapy dollars went | The share of therapy spending that went to providers affiliated with FAS versus other providers, shown with each group's average rate per hour. |
| o1 | Outcome change | How families' survey scores changed between the start and end of therapy. A negative change on a distress scale means they felt better. |
| median | Median | The middle value: half the families waited less, half waited more. |
| delta | Change from last quarter | How this quarter compares with the quarter before, in the same unit. |
| as_of | As of | The date of the newest record behind this number. |
| suppressed | Hidden to protect privacy | Fewer than 11 families, so the number is hidden. |
| complementary | Hidden to protect another number | Hidden so a smaller group next to it cannot be worked out from the total. |
| not_published | Not published | The source did not publish this value for this place in that release. |
| not_available | Not available yet | This number appears once the data behind it is set up. |
| fresh_current | Current | The newest release from this source is loaded. |
| fresh_stale | Stale | The last good update is older than the source's usual cycle. |
| fresh_failed | Last update failed | The last attempt to load this source failed; the previous good release is shown. |
| aggregate | Aggregate submission | A total that FAS entered as a total, not built up from individual records. |
| draft | AI draft | Written by software from stored numbers; a person must review it before it is used. |
| need_score | County need score | A relative score built from public indicators such as poverty and uninsured rates; higher means more need compared with other Utah counties. |
| rank | Rank | This county's place among the counties that have a score, 1 being the highest need. |
| placeholder_bins | Placeholder bands | Five equal-count colour bands used until FAS sets the final weights. |
| fas_county | FAS county | A county where FAS currently funds therapy. |
