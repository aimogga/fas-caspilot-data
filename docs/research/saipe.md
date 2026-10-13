# SAIPE (Small Area Income & Poverty Estimates), U.S. Census Bureau

> Deep Research source card. Checked 2026-10-08, 12:44–13:00 MDT. **VERIFIED-direct** = seen live that day · **VERIFIED-grok** = quoted from an official page by a live-search pass, not re-fetched · **ESTIMATE** = modeled · **INFERENCE** = reasoning · **unknown** = not found. Note: the Census Data API now requires a free key for all queries.

```
SOURCE: Small Area Income and Poverty Estimates — U.S. Census Bureau
ENDPOINT / FILE: https://api.census.gov/data/timeseries/poverty/saipe (KEY REQUIRED)   VERIFIED-direct 2026-10-08
                 https://www2.census.gov/programs-surveys/saipe/datasets/2024/2024-state-and-county/est24-ut.txt (no key)  VERIFIED-direct
AUTH: API key for API; none for bulk     RATE LIMITS: 50 vars/query; daily unknown
LATEST VINTAGE: 2024                     CADENCE: annual; 2025 estimates planned Dec 2026
GEOGRAPHY: state, county, school district
LICENSE / TERMS: CC0 in API metadata; Census API ToS notice   PERMITTED FOR FAS GRANT USE: yes
REQUIRED NOTICES: "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau." Don't use the Census Bureau name to imply endorsement.
FIELDS WE USE: SAEPOVALL_PT, SAEPOVRTALL_PT, SAEPOV0_17_PT, SAEMHI_PT
KNOWN LIMITS: model-based (Empirical Bayes shrinkage toward the model in small counties)
SAMPLE CALL: curl -s 'https://www2.census.gov/programs-surveys/saipe/datasets/2024/2024-state-and-county/est24-ut.txt'
             curl -s 'https://api.census.gov/data/timeseries/poverty/saipe?get=NAME,SAEPOVALL_PT,SAEPOVRTALL_PT,SAEPOV0_17_PT,SAEMHI_PT&for=county:*&in=state:49&time=2024&key=$CENSUS_API_KEY'
```
1. **Endpoint (VERIFIED-direct):**
   - **API, no key:** `GET https://api.census.gov/data/timeseries/poverty/saipe?get=NAME,SAEPOVALL_PT,SAEPOVRTALL_PT,SAEPOV0_17_PT,SAEMHI_PT&for=county:*&in=state:49&time=2024` returned **302 → missing_key.html** (`X-DataWebAPI-KeyError: 1`).
   - **Metadata:** `.../saipe.json` returned 200 JSON, temporal `2024/2024` for State and County, CC0 license.
   - **Bulk:** `est24-ut.txt` returned **200 text/plain**, 7,950 B, `Last-Modified: Tue, 27 Jan 2026 15:47:47 GMT`, 30 lines (state + 29 counties). The format is fixed-width. Sample row: `49   1      663 ... 74812 ... Beaver County  UT est24-ut.txt 07JAN2026`, which reads as poverty count 663, rate 9.5%, median household income $74,812.
2. **Vintage:**
   - 2024 estimates released **Jan 27, 2026**. **VERIFIED-direct** (file dates; the SAIPE page shows "State and County Estimates for 2024 – January 2026").
   - Next release: *"The 2025 release is planned for December 2026."* **VERIFIED-direct** (https://www.census.gov/programs-surveys/saipe/newsroom/updates.html). This matches the doc.
3. **License:** same as sahie.md. CC0 metadata plus the API ToS notice and no-endorsement rule. **Permitted for FAS grant use: yes.** VERIFIED-direct (ToS); INFERENCE (no use restriction).
4. **Key / limits:** same as sahie.md. **The API key is mandatory.** VERIFIED-direct.
5. **Utah coverage:** **29/29 VERIFIED-direct** (est24-ut.txt). Grok reports the only county omitted nationally is Kalawao, HI (**VERIFIED-grok**, P30-15 PDF). Census says SAIPE is the most accurate subnational poverty source for counties under 65k (**VERIFIED-grok**).
6. **Changed vs doc:** API key requirement (new). Otherwise as documented.
