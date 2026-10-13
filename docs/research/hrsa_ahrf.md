# Area Health Resources Files (AHRF), HRSA

> Deep Research source card. Checked 2026-10-08, 12:44–13:00 MDT. **VERIFIED-direct** = seen live that day · **VERIFIED-grok** = quoted from an official page by a live-search pass, not re-fetched · **ESTIMATE** = modeled · **INFERENCE** = reasoning · **unknown** = not found. Note: the Census Data API now requires a free key for all queries.

```
SOURCE: Area Health Resources Files 2024–2025 — HRSA (BHW/NCHWA)
ENDPOINT / FILE: https://data.hrsa.gov/DataDownload/AHRF/AHRF_2024-2025_CSV.zip   VERIFIED-direct 2026-10-08
AUTH: none        RATE LIMITS: none published
LATEST VINTAGE: 2024–2025 release (file Dec 18, 2025)   CADENCE: "Refresh Cycle: Annually"
GEOGRAPHY: county (state/national in sibling file)
LICENSE / TERMS: CONFLICT — download modal "Usage limitations: None" vs User Guide "Reproduction for reuse or resale is not authorized without the expressed permission of the Bureau"   PERMITTED FOR FAS GRANT USE: no without HRSA permission (FLAG: reuse permission needed)
REQUIRED NOTICES: Written HRSA permission before reuse; ADA/AHA/AMA-derived fields need the copyright owner's consent; HHS non-endorsement.
FIELDS WE USE: tot_md_do_psych, tot_md_do_child_psych, md_nf_psych_* (only BH workforce columns present)
KNOWN LIMITS: AMA/ADA/AHA-derived variables copyrighted; physician data through 2023
SAMPLE CALL: curl -sO https://data.hrsa.gov/DataDownload/AHRF/AHRF_2024-2025_CSV.zip
```
1. **Endpoint (VERIFIED-direct):** HEAD/GET returned **200 application/x-zip-compressed**, 23,287,136 B, `Last-Modified: Fri, 19 Dec 2025 01:54:18 GMT` (Dec 18, 2025, 6:54 PM MST). The zip holds 9 CSVs dated 2025-12-04: `AHRF2025.csv` (40 MB), plus `env/exp/geo/hf/hp/pop/utl` files. `AHRF2025geo.csv` header starts `fips_st_cnty,entity_file,...,st_name,cnty_name,...`. `AHRF2025hp.csv` has 1,927 columns.
2. **Vintage:** download page and AHRF dashboard show *"Updated: 01/29/2026 Refresh Cycle: Annually"* (**VERIFIED-direct**, https://data.hrsa.gov/topics/health-workforce/ahrf). The zip file date of Dec 18, 2025 matches the doc. No 2025–2026 file is posted yet (**VERIFIED-direct**, download link list). Next release: **ESTIMATE** late 2026.
3. **License, 🚩 conflict:**
   - The download modal (https://data.hrsa.gov/topics/health-workforce/ahrf, **VERIFIED-direct**) says: *"Data Published by: HRSA, Bureau of Health Workforce (BHW), National Center for Health Workforce Analysis (NCHWA) Usage limitations: None"*.
   - **The AHRF 2024–2025 User Guide** (inside https://data.hrsa.gov/DataDownload/AHRF/AHRF_USER_TECH_2024-2025.zip, `AHRF 2024-2025 User Guide.docx`, **VERIFIED-direct**) says: *"Reproduction for reuse or resale is not authorized without the expressed permission of the Bureau. Further, data from the American Dental Association, the American Hospital Association, and the American Medical Association are subject to copyright restrictions; these data may not be copied or reproduced in whole or in part without the prior consent of the copyright owner."*
   - data.gov lists CC0 (**VERIFIED-grok**).
   - **Permitted for FAS grant use: no without HRSA permission (FLAG: reuse permission needed). AMA-derived physician counts need AMA consent.** The doc's *"HRSA lists no usage limitations"* is incomplete.
4. **Key / limits:** none. **VERIFIED-direct**
5. **Utah coverage:** **29/29 VERIFIED-direct** (`AHRF2025geo.csv` and `AHRF2025hp.csv`, fips 49xxx). `md_nf_psych_23` is populated for all 29 UT counties (0 blanks; many zeros). **The county file's only behavioral health workforce variables are psychiatrists (MD/DO, incl. child psych).** My column scan found no psychologists, social workers, counselors, or MFTs. VERIFIED-direct; INFERENCE that it's complete, since it was a keyword scan.
6. **Changed vs doc:** **license risk (new).** The workforce measure is narrower than "behavioral health workforce" implies.
