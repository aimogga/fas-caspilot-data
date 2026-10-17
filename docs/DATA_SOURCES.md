# Data Source Registry

**Data use (D-015):** Public and FAS data in FAS Evidence is used only (1) for FAS to measure and validate the problem it solves, and (2) to provide or attach that data in FAS's grant applications for government grants and through GrantAdvance. No resale, no paid product, no other use. License checks below are for that use only.

Status key: **Use** = cleared for build · **Verify first** = Deep Research must confirm endpoint + license before code · **Manual reference** = cite in documents, don't ingest · **Avoid** = don't use in the product.
Facts below were checked in October 2026 research unless marked *verify*. Deep Research re-confirms every Phase 2 and Phase 5 row in Phase 0 and records a source card in `docs/research/`.

## Phase 2 — need data (MVP)
| ID | Source (owner) | What we use | Geography | Cadence / latest | Access | License / terms | Status |
|---|---|---|---|---|---|---|---|
| `sahie` | Small Area Health Insurance Estimates (Census) | Uninsured count & rate by age and income-to-poverty band | State, county | Annual; 2024 estimates released Aug 6, 2026 | Census API (`api.census.gov/data/timeseries/healthins/sahie` *verify*) or bulk CSV | Federal public data | Use |
| `saipe` | Small Area Income & Poverty Estimates (Census) | Poverty count and rate with MOE, all ages (`SAEPOVALL_*`, `SAEPOVRTALL_*`) and ages 0–17 (`SAEPOV0_17_*`, `SAEPOVRT0_17_*`); median income later | State, county | Annual; 2024 released Jan 2026; next planned Dec 2026 | Census API (`timeseries/poverty/saipe` *verify*) | Federal public data | Use |
| `acs5` | American Community Survey 5-year (Census) | Population (B01003), total households (B11001), veteran status (B21001), single-parent households (B11003), households with no vehicle (B08201); derived single-parent and no-vehicle percentages | County, tract | Annual; 2020–2024 released Jan 29, 2026 | Census API | Federal public data | Use |
| `hrsa_hpsa_mh` | HPSA — Mental Health (HRSA) | Designations, scores, designated population | Service areas → county | Refreshed daily (national file; Utah rows kept, other states' facility rows with FIPS `XXXXX` skipped) | data.hrsa.gov CSV downloads | Federal public data | Use |
| `cdc_places` | PLACES (CDC) | Depression, frequent mental distress (model-based) | County (tract later) | Annual; 2025 release Dec 4, 2025 (county dataset `swc5-untb`) holds **2023** data; the ingest sends no year filter by default and loads the year the release holds | Socrata API on data.cdc.gov | Public, no restrictions | Use |
| `ut_courts` | Utah Courts caseload statistics (AOC) | Filings by court type and county | County, district | Annual; statewide filings workbook FY2010–FY2026 | Excel download (no API) | Public records; AOC confirmed no restrictions on the public data file (email reply from courtdatarequest@utcourts.gov, 2026-10-15; D-038) | Use (file-based ingest) |
| `va_vetpop` | VetPop2023 county (VA) | Living veterans by county | County | Base FY2023, county file updated Aug 2026; rows are county × FY × age group × sex (`date, fips, state, age_group, sex, veterans`), FY2023–FY2053 projections. The ingest sums age × sex and loads every FY from FY2023 through the latest ended FY (George, 2026-10-17); readers show the newest | Socrata API on data.va.gov (dataset `jrjd-qghv`) | CC0 public domain | Use (round to thousands) |
| `hrsa_ahrf` | Area Health Resources Files (HRSA) | Behavioral health workforce per capita | County | Annual; updated Dec 18, 2025 | Bulk download | HRSA lists no usage limitations | Use (Phase 2b) |

### Census indicator codes (`public_indicator.indicator_code`, SAIPE and ACS)
Ingest code: `packages/ingest/saipe/` and `packages/ingest/acs5/`. Every code is loaded for all 29 Utah counties or the run fails closed (no partial loads); a Census `N/A`, blank or ACS `-` cell is stored as `value = null`, `unit = not_published`. Negative values and rates above 100 are rejected. Variable ids were checked against `api.census.gov/.../variables.json` (SAIPE timeseries; ACS 2024 5-year) in October 2026.

| Code | Source | Census variable(s) | Unit | MOE | Notes |
|---|---|---|---|---|---|
| `poverty_count` / `poverty_rate` | `saipe` | `SAEPOVALL_PT` / `SAEPOVRTALL_PT` (+ `_MOE`) | count / percent | yes | All ages. F-210 v1 and v2 input (rate). |
| `child_poverty_count` / `child_poverty_rate` | `saipe` | `SAEPOV0_17_PT` / `SAEPOVRT0_17_PT` (+ `_MOE`) | count / percent | yes | "Ages 0-17 in Poverty, Count/Rate Estimate". F-210 v2 input (rate). |
| `total_population` | `acs5` | `B01003_001E` | count | no | |
| `total_households` | `acs5` | `B11001_001E` | count | no | Denominator for the derived percentages below. |
| `veteran_population` | `acs5` | `B21001_002E` | count | no | |
| `single_parent_households` | `acs5` | `B11003_010E` + `B11003_016E` | count | no | Other family: male / female householder, no spouse present, with own children of the householder under 18 years. The two cells are summed; if either is unpublished the sum is unpublished. |
| `no_vehicle_households` | `acs5` | `B08201_002E` | count | no | Households with no vehicle available. |
| `single_parent_pct` / `no_vehicle_pct` | `acs5` (derived) | count ÷ `B11001_001E` × 100 | percent | no | Rounded to 1 decimal; `not_published` (null) when the count or the denominator is unpublished or the denominator is 0. F-210 v2 inputs. |

## Phase 5 — grants and funders
| ID | Source (owner) | What we use | Access | Rules / limits | Status |
|---|---|---|---|---|---|
| `grants_gov` | Simpler.Grants.gov API (HHS) | Federal opportunities: title, agency, Assistance Listing, dates, award floor/ceiling, eligibility, description. Weekly sweeps: four FAS themes, the Assistance Listings 93.104/93.243/93.556/93.590/93.670/16.540/16.575, and the health / social services / justice categories at HHS and DOJ; open opportunities only (`close_date` relative window) | `POST https://api.simpler.grants.gov/v1/opportunities/search`; `GET /v1/opportunities/{id}`; bulk extracts endpoint | Free key (Login.gov sign-in; Community → Developer → Manage API keys), sent as the `X-API-Key` header. 60 requests/min, 10,000/day. **Keys unused for 30 days are disabled** — the schedule must keep it active. API still evolving. | Use |
| `usaspending` | USAspending.gov API (Treasury) | Past federal awards: recipient, amount, place of performance, Assistance Listing, award description | `POST https://api.usaspending.gov/api/v2/search/spending_by_award/` with grant award types, `program_numbers`, `place_of_performance_locations` | No key in the official tutorial. Subawards are incomplete, so small pass-through grantees are often missing. | Use |
| `usaspending` (award detail) | USAspending.gov API (Treasury) | F-506c: full award description and period of performance for one opportunity's top 5 similar awards | `GET https://api.usaspending.gov/api/v2/awards/{generated_unique_award_id}/` | No key. Fetched on request, cached 30 days in `award_abstract` (`source = usaspending_detail`). Verified live 2026-10-15. | Use |
| `ojp_awards` | DOJ Office of Justice Programs award pages (`{ovc,bja,ojjdp,nij,bjs,smart}.ojp.gov/funding/awards/{award-number}`) | F-506c: the published award abstract ("Description of original award") for DOJ/OJP awards only | HTML page, parsed by `packages/ingest/ojp_awards` | Public domain. 1 request/second per host, User-Agent `FAS-Evidence/1.0`, robots.txt respected (`/funding/awards/` is allowed; `/user/login` is not). As of 2026-10-15 the pages redirect anonymous clients to sign-in, so rows are stored as `not_published` with that reason; parser UNVERIFIED against a live page. Other agencies get an `other` row, `not_published`, with the reason. | Use (UNVERIFIED) |
| `propublica_990` | ProPublica Nonprofit Explorer API | Org search, financials, filing list for nonprofits and foundations. F-507: funder 990-PF filing totals → `award_history` (quarterly). F-506b: winner profiles → `recipient_profile` (EIN, matched name, state, NTEE, ruling year, latest tax year, revenue, expenses, program service expenses and contributions share where extracted; match method and confidence high/medium/low/none), fetched on request for one opportunity's top 5 similar awards, cached 30 days; no officer names or compensation stored | `https://projects.propublica.org/nonprofits/api/v2/search.json`, `/organizations/{ein}.json`; `POST /api/ingest/winner-profiles` `{ opportunity_id }` | Free, no key; self-imposed 30 requests/min; a zero-result search or unknown EIN answers HTTP 404 (treated as not found); governed by ProPublica's Data Terms of Use (no SEO/ad-driven republishing; **attribution required**: show `PROPUBLICA_ATTRIBUTION` from `lib/grants/winner-profile.ts` wherever profiles or funder facts are displayed) | Use |
| `irs_990pf_grants` | IRS e-file 990-PF XML | Grants paid by foundations (recipient, amount, purpose) | IRS bulk e-file data, parsed | Large files; parsing effort; 1–2 year lag | Verify first (Phase 5b) |
| `sam_entity` | SAM.gov Entity API (GSA) | Check FAS's UEI/registration status for federal eligibility | API key | *verify* terms and fields | Verify first |
| `ut_transparency` | Utah state transparency site | State payments/grants to nonprofits (state pass-through funding) | *verify* | *verify* | Verify first |

**Award abstracts are for analysis only (F-506c).** `award_abstract` text describes what other organizations proposed. It is never copied into FAS drafts or exports; strategy drafts may cite that an abstract exists and its themes, not its wording (docs/GRANT_MATCHING.md guardrails). A missing abstract is a stored `not_published` row with its reason, so the UI can say "no public abstract".

## Reference only (cite in documents; don't build into the product)
| Source | Why |
|---|---|
| NSDUH (SAMHSA) state estimates | State-level only; good for narrative context |
| N-SUMHSS / FindTreatment.gov (SAMHSA) | Facility data; FindTreatment API needs registration; *verify* before ingesting |
| Utah SUMH Mental Health Treatment Scorecards (OQ/YOQ) | PDFs; enter benchmark values manually once a year for the outcome comparison panel |
| DCFS annual reports, Legislative Auditor reports | PDFs; narrative citations |
| Child Welfare Outcomes data site (ACF) | State-level context |
| CDC WONDER | Manual queries; rural Utah counts often suppressed |
| IBIS-PH (Utah DHHS) | Terms forbid linkage that could identify people and limit use to community-benefit purposes. **Ask Utah DHHS before putting it in a product.** Fine to cite manually. |
| NCSC Court Statistics Project | State-level comparisons for expansion planning |

## Avoid inside the product
| Source | Why |
|---|---|
| KIDS COUNT Data Center (Annie E. Casey) | Terms allow non-commercial, educational or personal use only. Pull the underlying Census data directly instead. |
| NDACAN restricted files (AFCARS, NCANDS, NYTD microdata) | Licensed-researcher access, IRB, one machine per user; not usable in a product |
| Scraped court case lists (Xchange, weekly reports) | Ethically and legally fraught; not needed |
| Scraping funder or third-party sites | Use APIs and public filings instead |
