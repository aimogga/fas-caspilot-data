# HPSA Mental Health, HRSA

> Deep Research source card. Checked 2026-10-08, 12:44–13:00 MDT. **VERIFIED-direct** = seen live that day · **VERIFIED-grok** = quoted from an official page by a live-search pass, not re-fetched · **ESTIMATE** = modeled · **INFERENCE** = reasoning · **unknown** = not found. Note: the Census Data API now requires a free key for all queries.

```
SOURCE: Health Professional Shortage Areas — Mental Health — HRSA (BHW/DPSD)
ENDPOINT / FILE: https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_MH.csv   VERIFIED-direct 2026-10-08
AUTH: none                                RATE LIMITS: none published (unknown)
LATEST VINTAGE: daily snapshot (10/8/2026) CADENCE: "Refresh Cycle: Daily"
GEOGRAPHY: HPSA components (county, tract, catchment) → county via FIPS column
LICENSE / TERMS: "Usage limitations: None"   PERMITTED FOR FAS GRANT USE: yes
REQUIRED NOTICES: HHS non-endorsement: don't imply HHS/HRSA endorsement; attribute HRSA BHW.
FIELDS WE USE: HPSA ID, Designation Type, HPSA Status, HPSA Score, HPSA Designation Population, State and County FIPS
KNOWN LIMITS: withdrawn rows retained; designations are components, not one flag per county
SAMPLE CALL: curl -sO https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_MH.csv
```
1. **Endpoint (VERIFIED-direct):** `GET .../BCD_HPSA_FCT_DET_MH.csv` returned **200 application/octet-stream**, 20,392,445 B, `Last-Modified: Thu, 08 Oct 2026 11:48:34 GMT` (5:48 AM MDT, regenerated today). It is CSV with 33,518 rows and a 60+ column header: `HPSA Name,HPSA ID,Designation Type,HPSA Discipline Class,HPSA Score,Primary State Abbreviation,HPSA Status,...`. Sample: `Morgan County | 7499822702 | Geographic HPSA | score 13 | Designated | pop 12572`.
2. **Vintage / cadence:** download page shows *"Updated: 10/8/2026 Refresh Cycle: Daily"*. **VERIFIED-direct** (https://data.hrsa.gov/data/download). The latest UT "Designation Last Update Date" is 09/22/2025 (**VERIFIED-direct**). Withdrawals take effect via an annual Federal Register notice around July 1 (**VERIFIED-grok**).
3. **License:** HPSA Mental Health "Data Usage Terms & Conditions" on https://data.hrsa.gov/data/download: *"Data Published by: HRSA, Bureau of Health Workforce (BHW), Division of Policy and Shortage Designation (DPSD) Usage limitations: None"* **VERIFIED-direct.** HHS disclaimer: no implied endorsement (**VERIFIED-grok**, https://www.hhs.gov/digital/policies/disclaimers/index.html). **Permitted for FAS grant use: yes.** INFERENCE: also a U.S. Government work under 17 U.S.C. §105.
4. **Key / limits:** no key, no registration. **VERIFIED-direct.** Rate limits: unknown (none published).
5. **Utah coverage (VERIFIED-direct, my parse of today's file):**
   - 149 UT rows: Designated 27, Proposed For Withdrawal 2, Withdrawn 120.
   - Designated + proposed-for-withdrawal rows cover **27 distinct county FIPS**. **Missing: 49011 Davis and 49057 Weber**, which appear only as *Withdrawn*. Grok independently found the same (12 currently designated unique MH HPSAs).
   - There is no suppression field, and small values are not blanked.
   - **Product implication (INFERENCE):** show Davis/Weber as "no current MH HPSA designation," not "missing data."
6. **Changed vs doc:** none. Doc is accurate. Add a coverage note: 27/29 counties designated.
