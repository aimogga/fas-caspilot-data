# LLM bake-off rubric (F-508i, D-003)

QA scores the drafts from `pnpm eval:llm` with this rubric. The script writes `harness/audits/llm-bakeoff-<date>.json`, a summary table `llm-bakeoff-<date>.md`, and one draft per run in `llm-bakeoff-<date>/<provider>-<opportunity>.json`. Providers: `gemini` (primary) and `openrouter` (free-tier fallback), each forced in turn (`forceProvider`, eval only, `LLM_EVAL=1`). Inputs are public opportunity text and synthetic aggregates only.

## Decision rule (D-003 memo, as amended 2026-10-15)

> The provider with higher citation accuracy wins; a tie goes to the higher QA rubric mean (D-003 memo).

- **Citation accuracy** comes from the automatic scores below (`citation_accuracy` per provider in the report). The report's `automatic_leader` names the winner, or is `null` on a tie or when a provider has no data. Only then does the rubric mean decide.
- **Rubric mean** = the mean of all four rubric scores over all of that provider's reviewed drafts (skipped runs are not scored).
- If the result would switch the primary provider away from Gemini, it goes to George (packet #244, human gate). Record the result as a D-003 note in `harness/DECISIONS.md`.

## Automatic scores (computed by `lib/strategy/bakeoff.ts`; do not re-score by hand)

Per run (`scoreRun`):

| Field | Meaning |
|---|---|
| `schema_valid` | The output parses against `StrategyDraftSchema` (yes/no). |
| `numbers_present` | Numbers stated in the draft's claims. |
| `numbers_resolving` | Of those, numbers that match a value in a fact they cite. |
| `citation_accuracy` | `numbers_resolving / numbers_present` (lib/strategy citations); `null` when no numbers are present. |
| `copy_hits` | Copy-guard hits (text copied from award abstracts). |
| `inferences_separated` | Items in the `inferences` list that start with "Inference:". |
| `inferences_misplaced` | Criterion positions or evidence claims that contain "Inference:" (should be in `inferences`). |
| `latency_ms` | Total model latency across rounds. |
| `input_tokens`, `output_tokens` | Total tokens across rounds. |
| `rounds` | Model rounds used (a failed citation check retries once). |

Per provider (`summarize`): `runs`, `skipped`, `schema_valid`, `drafts_ok` (status DRAFT), `numbers_present`, `numbers_resolving`, `citation_accuracy` (pooled: total resolving / total present), `copy_hits`, `inferences_separated`, `inferences_misplaced`, `mean_latency_ms`, `input_tokens`, `output_tokens`. Skipped runs give a reason: `missing_key`, `quota` or `call_cap` (20 calls, one every 4 s).

## Human rubric (score each draft 1–5)

Read the draft next to its snapshot (the stored facts it cites). Score each dimension as a whole number.

| Dimension | 1 | 3 | 5 |
|---|---|---|---|
| **Claims true to the snapshot** | A claim states a number or fact the snapshot does not hold, or misreads one. | Claims are true but some are vague or loosely tied to the cited fact. | Every claim matches the cited fact exactly; nothing is invented. |
| **Usefulness of the criteria map** | Criteria missing or the FAS position is generic. | Most criteria covered; positions are partly specific. | Every criterion covered with a specific FAS position and the right evidence. |
| **Plain language** | Jargon, long sentences, hard for a non-data reader. | Mostly clear with some jargon. | Short, plain sentences a board member reads without help. |
| **Gaps and risks named** | Gaps and risks missing or boilerplate. | Some real gaps or risks named. | Real gaps (missing data, eligibility doubts) and risks named, with what would close them. |

A draft with status FAILED (citation check failed) or an invalid schema scores 1 on every dimension.

## Score sheet

Fill one row per draft. Opportunities are the five in `tests/eval/llm/opportunities.json`.

| Provider | Opportunity | Claims true | Criteria map | Plain language | Gaps and risks | Mean | Reviewer note |
|---|---|---|---|---|---|---|---|
| gemini | O-OJJDP-2026-172752 | | | | | | |
| gemini | HRSA-27-021 | | | | | | |
| gemini | HRSA-27-043 | | | | | | |
| gemini | UOVC-VOCA | | | | | | |
| gemini | SORENSON-LEGACY | | | | | | |
| openrouter | O-OJJDP-2026-172752 | | | | | | |
| openrouter | HRSA-27-021 | | | | | | |
| openrouter | HRSA-27-043 | | | | | | |
| openrouter | UOVC-VOCA | | | | | | |
| openrouter | SORENSON-LEGACY | | | | | | |

| Provider | Citation accuracy (report) | Rubric mean | Winner |
|---|---|---|---|
| gemini | | | |
| openrouter | | | |
