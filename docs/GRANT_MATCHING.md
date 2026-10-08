# Grant Matching, Explanations and Response Strategy

## What's realistic (read this first)
- **Public:** who won federal grants, how much, when, where, under which Assistance Listing, plus a short award description (USAspending); which foundations funded which nonprofits and how much (990-PF); and, most valuable, **each opportunity's own published evaluation criteria** (the NOFO/RFP).
- **Not public:** what winners actually wrote. The strategy builder must never imply it knows. It positions FAS against the *published scoring criteria*, using FAS's evidence and patterns in award records.
- **Fit reality for FAS today:** many federal grants require active SAM.gov registration (UEI), audits, multi-year operating history or matching funds. Expect most strong fits to be Utah foundations and state pass-through funding. That's why foundation opportunities are first-class inputs, not an afterthought.

## Pipeline
```
ingest opportunities → normalize → hard eligibility filters → fit score → "How we matched" → human review
                                                         └─ on request: award history → strategy draft → human approval → export
```

## Hard eligibility filters (flags, not silent drops)
| Check | Source | Result |
|---|---|---|
| Applicant type includes 501(c)(3) nonprofits | opportunity eligibility | pass / fail |
| Geography includes Utah or is national | opportunity text | pass / fail / unclear |
| Close date ≥ 21 days away (configurable) | close_date | pass / warn |
| SAM.gov registration / UEI required | opportunity text + org.uei | pass / action needed |
| Audit required | opportunity text + org settings | pass / blocker |
| Match / cost share required | opportunity text | pass / warn (show %) |
| Minimum years operating | opportunity text + org settings | pass / blocker |
| Award size vs. FAS annual budget | award floor/ceiling + org budget | fit / too large / too small |

## Fit score v0 (0–100; weights live in a versioned config table)
| Component | Weight | How it's scored | Shown as |
|---|---|---|---|
| Mission fit | 30 | Match on configured themes: therapy access, court-involved families, family preservation/reunification, mental health, veterans/military families, Utah | Matched phrases with their location in the opportunity text |
| Eligibility certainty | 20 | Share of hard checks passed without "unclear" | Checklist |
| Evidence readiness | 15 | Do we have the metrics the criteria ask for (outcomes, cost, timeliness)? | List of available vs. missing evidence |
| Award size fit | 15 | Ceiling/floor vs. FAS budget and past awards | Range comparison |
| Geography | 10 | Utah-specific > regional > national | Text |
| Effort vs. time | 10 | Days to deadline vs. typical prep time | Days |

Every component stores `reason` and `source_refs`. The "How we matched" panel renders these directly; no free-text summary without them.

## Award history ("who won similar grants")
- Federal: USAspending awards for the same Assistance Listing number(s), filter by state (Utah first, then peer states), last 3–5 fiscal years.
- Foundations: 990-PF grants paid by the funder, by year and recipient.
- Summary computed in SQL (not by the LLM): count of awards, median and range of amount, recipient types, share in Utah, most common words/themes in award descriptions.

## Strategy draft (on request)
**Inputs (snapshot stored with the draft):** opportunity text and criteria, FAS metrics (suppressed), county need indicators, award-history summary, org profile.

**Output schema (validated before display):**
```json
{
  "opportunity_id": "uuid",
  "status": "DRAFT",
  "criteria_map": [
    {
      "criterion": "Need for the project (20 pts)",
      "fas_position": "string",
      "evidence": [{"claim": "string", "citation_id": "public_indicator:123"}],
      "gaps": ["string"],
      "confidence": "high|medium|low"
    }
  ],
  "suggested_ask": {"low": 0, "high": 0, "basis_citation_ids": ["award_history_summary:45"]},
  "risks": ["string"],
  "narrative_outline": ["string"],
  "inferences": ["string labeled as inference"]
}
```
**Validation:** every number in `fas_position`, `evidence`, `suggested_ask` must map to a `citation_id` that resolves in the database. If not, the draft is rejected and regenerated or shown as failed.

**Guardrails:** DRAFT label on screen and in exports; staff approval required before export; no copying text from other organizations' award descriptions; inferences listed separately.

## Evaluation (F-509)
QA maintains a labeled set of at least 20 opportunities (fit / not fit, with reasons). Target precision ≥ 70% at the digest threshold. Any change to weights or matching code must not lower precision on this set.
