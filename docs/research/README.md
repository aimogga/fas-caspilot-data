# Research source cards
Deep Research adds one card per data source here (`<source-id>.md`), using the format in the Deep Research role card. Every card has a working sample call, latest vintage, license and a "Permitted for FAS grant use" answer plus required notices, with dates.

## Sample-call re-check, 2026-10-17
Every card's `SAMPLE CALL` was run as written from a cloud session (F-002). "Blocked" means a person has to act first; the card says who and why.

| Card | DATA_SOURCES status | Sample call 2026-10-17 | Notes |
|---|---|---|---|
| `sahie` | Use | 200, zip 13.7 MB | |
| `saipe` | Use | 200, Utah line returned | |
| `acs5` | Use | 200, 29 Utah county rows | API variant needs `CENSUS_API_KEY` |
| `hrsa_hpsa_mh` | Use | 200, about 25 MB CSV | Header has a trailing comma; other states' rows carry FIPS `XXXXX` (#207) |
| `cdc_places` | Use | 200, 58 rows (2023 data) | Sample rewritten as `curl -G --data-urlencode` (the bare URL had spaces) |
| `ut_courts` | Use (file-based) | 200, xlsx 1.59 MB | Needs a browser User-Agent |
| `va_vetpop` | Use | 200, 29 counties FY2026 | Sample rewritten as `curl -G`; ingest loads FY2023 to the latest ended FY |
| `hrsa_ahrf` | Use (Phase 2b) | 200 zip | `AHRF_2025-2026` not posted yet (404) |
| `grants_gov` | Use | 200, "Webservice Succeeds" | |
| `usaspending` | Use | 200 search and 200 award detail | Award-detail row now covered in the card |
| `ojp_awards` | Use (UNVERIFIED) | 307 to sign-in | **New card.** Abstracts aren't public; rows stay `not_published` |
| `propublica_990` | Use | 200, 584 Utah results | Terms read: cite ProPublica, no raw redistribution |
| `irs_990pf_grants` | Verify first | 200 index and 200 batch zip (152 MB) | Grant fields confirmed in real 2025 XML |
| `sam_entity` | Verify first | Blocked | Needs a SAM.gov API key and FAS's UEI (George) |
| `ut_transparency` | Verify first | Blocked | Bulk data is BigQuery "Super User" access: an email to the state and GCP billing (George) |
