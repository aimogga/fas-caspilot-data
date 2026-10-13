# ACS 5-year (2020–2024), U.S. Census Bureau

> Deep Research source card. Checked 2026-10-08, 12:44–13:00 MDT. **VERIFIED-direct** = seen live that day · **VERIFIED-grok** = quoted from an official page by a live-search pass, not re-fetched · **ESTIMATE** = modeled · **INFERENCE** = reasoning · **unknown** = not found. Note: the Census Data API now requires a free key for all queries.

```
SOURCE: American Community Survey 5-year — U.S. Census Bureau
ENDPOINT / FILE: https://api.census.gov/data/2024/acs/acs5 (KEY REQUIRED)   VERIFIED-direct 2026-10-08
                 https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-<table>.dat (no key)  VERIFIED-direct
AUTH: API key for API; none for Summary File    RATE LIMITS: 50 vars/query; daily unknown
LATEST VINTAGE: 2020–2024                       CADENCE: annual; 2021–2025 tentatively Dec 2026 (DAO risk)
GEOGRAPHY: county, tract (and smaller)
LICENSE / TERMS: CC0 in API metadata; Census API ToS   PERMITTED FOR FAS GRANT USE: yes
REQUIRED NOTICES: "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau." Don't use the Census Bureau name to imply endorsement.
FIELDS WE USE: B01003_001E (pop), B21001_002E (veterans), B25010_001E (avg HH size)
KNOWN LIMITS: MOEs (inflated by 2020 pandemic year); Title 13; county 1-yr not available <65k
SAMPLE CALL: curl -s '.../acsdt5y2024-b01003.dat' | grep '^0500000US49'
```
1. **Endpoint (VERIFIED-direct):**
   - **API, no key:** `GET https://api.census.gov/data/2024/acs/acs5?get=NAME,B01003_001E,B21001_002E,B25010_001E&for=county:*&in=state:49` returned **302 → missing_key.html**. Even the minimal `.../2023/acs/acs5?get=NAME&for=state:49` was blocked.
   - **Metadata:** `.../2024/acs/acs5.json` returned 200 JSON with CC0 license. `data.json` lists acs5 vintages up to **2024** (no 2025 yet).
   - **Summary File:** `acsdt5y2024-b01003.dat` returned **200** (no content-type header), 18.3 MB, `Last-Modified: Thu, 29 Jan 2026 12:31:45 GMT`. It is pipe-delimited: `GEO_ID|B01003_E001|B01003_M001`, sample `0500000US49001|7273|-555555555` (Beaver County population 7,273; `-555555555` = MOE not applicable). `acsdt5y2024-b21001.dat` (veteran status) returned 200, 152 MB.
2. **Vintage:**
   - 2020–2024 released **Jan 29, 2026**. **VERIFIED-direct** (Summary File Last-Modified; Grok cites the CB26-17 embargo release). This matches the doc.
   - Next 5-year release (2021–2025): an older schedule lists Dec 2026 (**VERIFIED-grok**). However, on Aug 4, 2026 Census said the 2025 ACS 1-year date "is being determined" because of new Commerce Department disclosure-avoidance (DAO) rules (**VERIFIED-grok**, CB26-129). **ESTIMATE:** December 2026 is at risk of slipping.
3. **License:** same as Card 1. **Permitted for FAS grant use: yes.**
4. **Key / limits:** Grok quotes the ACS 5-year developer page: *"All data queries to the Census Data API now require an API key."* (**VERIFIED-grok**). The same rule is **VERIFIED-direct** on the Query Limits page.
5. **Utah coverage:** **29/29 VERIFIED-direct** (`grep -c '^0500000US49'` = 29 in both B01003 and B21001). The 5-year tables are generally not quality-filtered except some medians (**VERIFIED-grok**, ACS Data Release Rules). Going forward, the Commerce disclosure-avoidance policy may coarsen or suppress small-area data in *future* vintages (**VERIFIED-grok**, Director's blog Aug 17, 2026). That is a risk for small Utah counties (INFERENCE).
6. **Changed vs doc:** API key requirement (new). New disclosure-avoidance policy is a future-vintage risk.
