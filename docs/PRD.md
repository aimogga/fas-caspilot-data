# PRD — "Public Data to Proof" for Family Advocacy Services

**Owner:** George Mogga (CasePilot) · **Customer:** Family Advocacy Services (FAS), Utah · **Status:** v1 draft, Oct 2026

## 1. Problem and goal
Every funder asks FAS two questions: *Is the need real?* and *Does your help work?* Free public data can answer the first. Only FAS's own records can answer the second. Today FAS has no system that does either reliably.

**Goal:** one FAS Evidence tool that keeps public need data fresh, captures FAS's own results, shows both clearly, finds grants that fit, explains the fit, drafts a cited response strategy, and exports packets FAS can print or attach.

## 2. Users and roles
| Role | Who | Can |
|---|---|---|
| `admin` | George / CasePilot | Everything, incl. settings, users, data sources |
| `staff` | FAS program director, case managers, grant writer | Enter/upload FAS data, view everything for FAS, run matches, request strategy drafts, export |
| `board_viewer` | FAS board members | View the board dashboard and download board packets (suppressed, aggregate only) |

Design for `org_id` (tenant) on every FAS table from day one so other nonprofits can be added later. No billing in v1.

## 3. Capabilities and acceptance criteria
Feature IDs refer to `harness/feature_list.json`.

### C1 — Public data collector (Phase 2: F-201…F-211)
- Scheduled, idempotent ingestion for the MVP sources in `docs/DATA_SOURCES.md` (SAHIE, SAIPE, ACS, HRSA mental health HPSA, CDC PLACES, Utah Courts filings, VA VetPop).
- Every run is logged (source, vintage, rows, checksum, status). Failures alert the team.
- Data freshness panel shows each source's latest vintage and last successful run.
- All 29 Utah counties present for every county-level indicator (or an explicit "not published" marker).

### C2 — FAS data intake (Phase 3: F-301…F-303)
- **Upload:** CSV/XLSX with a downloadable template; column-mapping screen; validation (required fields, types, date order, county codes, allowed values); preview before commit; downloadable error report; each upload is a versioned batch that can be rolled back.
- **Manual entry:** forms for case, application, authorization, delivery and outcome records, with the same validation.
- **Aggregate-only path:** for organizations that only have totals (e.g., "42 families served in Q2, 31 completed"), store as aggregate submissions clearly labeled as such.
- Fields follow the minimum schema (no clinical notes): case (opaque ID, referral source, court involvement, court order date, referral date, county, household size, income band, prior services tried); application (dates, decision, award amount, family contribution); authorization (service type, provider, provider_affiliated, units, rate, total authorized); delivery (first/last session, sessions attended, no-shows, discharge status, dollars paid); outcome (measure, baseline score, follow-up score, date).

### C3 — Metrics engine (Phase 3: F-304…F-306)
Definitions are code-reviewed and documented on a methodology page. Defaults are configurable.
| ID | Metric | Definition (v1) |
|---|---|---|
| M1 | Days from court order to first session | For cases with `court_involved = true` and both dates: `first_session_date − court_order_date`. Report median, 25th/75th percentile, count, and share still waiting. |
| M2 | Days from application to funding decision | `decision_date − application_date` for decided applications. Median + distribution. |
| M3 | Eligible applicants who never start, with reason | Approved applications with no first session within 60 days of approval (configurable) ÷ approved applications; broken down by `non_start_reason`. |
| M4 | Completion rate by income band | Episodes with `discharge_status = completed` ÷ episodes closed, per income band. |
| M5 | Cost per completed episode | Sum of `dollars_paid` on completed episodes ÷ count of completed episodes. Also show total program dollars ÷ completed episodes. |
| M6 | Share of dollars to affiliated vs. unaffiliated providers | Sum of `dollars_paid` where `provider_affiliated = true` ÷ all dollars paid; always shown with average rate per unit for each group. |
| O1 | Outcome change | Mean (and share improved) of follow-up minus baseline per measure (OQ-45, YOQ, PHQ-9, GAD-7; direction configured per measure). |

All metrics: filter by date range, county and referral source; small-cell suppression in every shared view.

### C4 — County need score (Phase 2: F-210)
- Weighted z-score of: uninsured rate (SAHIE), mental health shortage (HRSA), poor mental health prevalence (CDC PLACES), court filings per 1,000 residents (Utah Courts + ACS population). Optional layers: child poverty (SAIPE), veterans per 1,000 (VetPop).
- Weights stored in a versioned config table; methodology page explains inputs, weights, vintages and limits. Scores are relative rankings, not absolute measures of need.

### C5 — Visuals (Phase 2 & 4: F-211, F-401, F-402)
- **Team dashboard:** six metrics + outcomes with trends, filters, data freshness, pipeline of grant opportunities.
- **Board dashboard:** one screen, plain language, suppressed aggregates, print-friendly, "data as of" dates on every number.
- **County explorer:** Utah map colored by need score, click a county for its indicators with sources and dates.

### C6 — Grant match (Phase 5: F-501…F-505, F-509)
- Ingest federal opportunities from the Simpler.Grants.gov API on a schedule (keep the API key active).
- Foundation opportunities via manual entry or CSV import (e.g., exported from FAS's foundation research tools).
- Hard eligibility filters with visible flags (applicant type, geography, deadline window, SAM.gov/UEI requirement, audit requirement, match requirement, minimum years operating, award size vs. FAS budget).
- Fit score 0–100 with a **"How we matched"** panel listing every component, its reason and its source.
- Pipeline statuses: new → reviewing → pursuing → submitted → awarded / declined / passed.
- Weekly digest email of new matches above a threshold.

### C7 — Award history (Phase 5: F-506, F-507)
- For a matched federal opportunity: past awards under the same Assistance Listing from USAspending (recipient, state, amount, dates, award description).
- For foundations: grants paid by that foundation from public 990-PF data (recipient, amount, purpose, year).
- Summary of patterns: typical award size range, recipient types, geography, recurring themes. Clearly states that full winning applications are not public.

### C8 — Response strategy builder (Phase 5: F-508), on request only
- Inputs: the opportunity's evaluation criteria (parsed or pasted), FAS metrics, public need indicators, award-history patterns.
- Output: criterion-by-criterion positioning map; evidence to cite (each with source + date); gaps and risks (e.g., missing audit, weak outcome data); suggested ask range grounded in award history; narrative outline.
- Every number cites a stored row; anything without a citation is rejected. Labeled **DRAFT — human review required**. Exportable only after a staff member approves it.

### C9 — Evidence packets (Phase 4: F-403, F-404)
- PDF (print) and DOCX (edit/attach) plus CSV appendix.
- Sections: county need profile, FAS results (suppressed), outcomes, methodology and sources page with dates, suppression note, related-party disclosure (M6).
- Variants: grant attachment (by county or statewide), board packet.

### C10 — Admin and audit (Phase 1 & 6)
- Roles + RLS; audit log of uploads, edits, exports, strategy approvals; data-source settings; nightly audit reports visible to admins.

## 4. Non-goals for v1
Clinical notes or EHR integration · submitting applications on FAS's behalf · scraping court case lists or any site whose terms forbid it · KIDS COUNT or NDACAN restricted data inside the product · billing and multi-org self-service signup (design for it, don't build it).

## 5. Success measures
- Public data refreshes without human help for 30 consecutive days.
- FAS can produce a board packet and a grant attachment in under 10 minutes.
- Grant match precision ≥ 70% on the labeled eval set (F-509).
- Zero privacy test failures in nightly audits after Phase 3.
