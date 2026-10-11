# Data Source Registry

**Data use (D-015):** Public and FAS data in FAS Evidence is used only (1) for FAS to measure and validate the problem it solves, and (2) to provide or attach that data in FAS's grant applications for government grants and through GrantAdvance. No resale, no paid product, no other use. License checks below are for that use only.

Status key: **Use** = cleared for build · **Verify first** = Deep Research must confirm endpoint + license before code · **Manual reference** = cite in documents, don't ingest · **Avoid** = don't use in the product.
Facts below were checked in October 2026 research unless marked *verify*. Deep Research re-confirms every Phase 2 and Phase 5 row in Phase 0 and records a source card in `docs/research/`.

## Phase 2 — need data (MVP)
| ID | Source (owner) | What we use | Geography | Cadence / latest | Access | License / terms | Status |
|---|---|---|---|---|---|---|---|
| `sahie` | Small Area Health Insurance Estimates (Census) | Uninsured count & rate by age and income-to-poverty band | State, county | Annual; 2024 estimates released Aug 6, 2026 | Census API (`api.census.gov/data/timeseries/healthins/sahie` *verify*) or bulk CSV | Federal public data | Use |
| `saipe` | Small Area Income & Poverty Estimates (Census) | Poverty (all ages, children), median income | State, county | Annual; 2024 released Jan 2026; next planned Dec 2026 | Census API (`timeseries/poverty/saipe` *verify*) | Federal public data | Use |
| `acs5` | American Community Survey 5-year (Census) | Population denominators, household size, veteran status | County, tract | Annual; 2020–2024 released Jan 29, 2026 | Census API | Federal public data | Use |
| `hrsa_hpsa_mh` | HPSA — Mental Health (HRSA) | Designations, scores, designated population | Service areas → county | Refreshed daily | data.hrsa.gov CSV downloads | Federal public data | Use |
| `cdc_places` | PLACES (CDC) | Depression, frequent mental distress (model-based) | County (tract later) | Annual; 2025 release Dec 4, 2025 (county dataset `swc5-untb`) | Socrata API on data.cdc.gov | Public, no restrictions | Use |
| `ut_courts` | Utah Courts caseload statistics (AOC) | Filings by court type and county | County, district | Annual; statewide filings workbook FY2010–FY2026 | Excel download (no API) | Public records; *verify* bulk reuse terms | Use (file-based ingest) |
| `va_vetpop` | VetPop2023 county (VA) | Living veterans by county | County | Base FY2023, county file updated Aug 2026 | Socrata API on data.va.gov (dataset `jrjd-qghv`) | CC0 public domain | Use (round to thousands) |
| `hrsa_ahrf` | Area Health Resources Files (HRSA) | Behavioral health workforce per capita | County | Annual; updated Dec 18, 2025 | Bulk download | HRSA lists no usage limitations | Use (Phase 2b) |

## Phase 5 — grants and funders
| ID | Source (owner) | What we use | Access | Rules / limits | Status |
|---|---|---|---|---|---|
| `grants_gov` | Simpler.Grants.gov API (HHS) | Federal opportunities: title, agency, Assistance Listing, dates, award floor/ceiling, eligibility, description | `POST https://api.simpler.grants.gov/v1/opportunities/search`; `GET /v1/opportunities/{id}`; bulk extracts endpoint | Free key (Login.gov sign-in). 60 requests/min, 10,000/day. **Keys unused for 30 days are disabled** — the schedule must keep it active. API still evolving. | Use |
| `usaspending` | USAspending.gov API (Treasury) | Past federal awards: recipient, amount, place of performance, Assistance Listing, award description | `POST https://api.usaspending.gov/api/v2/search/spending_by_award/` with grant award types, `program_numbers`, `place_of_performance_locations` | No key in the official tutorial. Subawards are incomplete, so small pass-through grantees are often missing. | Use |
| `propublica_990` | ProPublica Nonprofit Explorer API | Org search, financials, filing list for nonprofits and foundations | `https://projects.propublica.org/nonprofits/api/v2/search.json`, `/organizations/{ein}.json` | Free, no key; governed by ProPublica's Data Terms of Use (no SEO/ad-driven republishing) | Use |
| `irs_990pf_grants` | IRS e-file 990-PF XML | Grants paid by foundations (recipient, amount, purpose) | IRS bulk e-file data, parsed | Large files; parsing effort; 1–2 year lag | Verify first (Phase 5b) |
| `sam_entity` | SAM.gov Entity API (GSA) | Check FAS's UEI/registration status for federal eligibility | API key | *verify* terms and fields | Verify first |
| `ut_transparency` | Utah state transparency site | State payments/grants to nonprofits (state pass-through funding) | *verify* | *verify* | Verify first |

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
