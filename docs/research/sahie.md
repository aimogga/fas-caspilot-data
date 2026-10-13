# SAHIE (Small Area Health Insurance Estimates), U.S. Census Bureau

> Deep Research source card. Checked 2026-10-08, 12:44–13:00 MDT. **VERIFIED-direct** = seen live that day · **VERIFIED-grok** = quoted from an official page by a live-search pass, not re-fetched · **ESTIMATE** = modeled · **INFERENCE** = reasoning · **unknown** = not found. Note: the Census Data API now requires a free key for all queries.

```
SOURCE: Small Area Health Insurance Estimates — U.S. Census Bureau
ENDPOINT / FILE: https://api.census.gov/data/timeseries/healthins/sahie (KEY REQUIRED)   VERIFIED-direct 2026-10-08
                 https://www2.census.gov/programs-surveys/sahie/datasets/time-series/estimates-acs/sahie-2024-csv.zip (no key)  VERIFIED-direct
AUTH: API key (free) for API; none for bulk         RATE LIMITS: 50 variables/query; no published daily number
LATEST VINTAGE: 2024                                CADENCE: annual; next release "Summer 2027"
GEOGRAPHY: state, county (no county race)
LICENSE / TERMS: metadata license = CC0 1.0; API ToS requires "not endorsed or certified" notice   PERMITTED FOR FAS GRANT USE: yes
REQUIRED NOTICES: "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau." Don't use the Census Bureau name to imply endorsement.
FIELDS WE USE: bulk CSV names NIPR, NUI, PCTUI (+ nipr_moe etc.) by agecat / iprcat; API names add a _PT suffix (NIPR_PT, NUI_PT, PCTUI_PT; MOEs as _MOE). NIPR = people in the group, NUI = uninsured count, PCTUI = % uninsured. The API call below also pulls NIC_PT (insured count), which has no row in our field list
KNOWN LIMITS: model-based; 90% MOEs; under-65 only; no county race/ethnicity
SAMPLE CALL: curl -sLO 'https://www2.census.gov/programs-surveys/sahie/datasets/time-series/estimates-acs/sahie-2024-csv.zip'
             curl -s "https://api.census.gov/data/timeseries/healthins/sahie?get=NAME,NIC_PT,NUI_PT,PCTUI_PT&for=county:*&in=state:49&time=2024&AGECAT=0&IPRCAT=0&SEXCAT=0&RACECAT=0&key=$CENSUS_API_KEY"
```
1. **Endpoint (VERIFIED-direct):**
   - **API, no key:** `GET https://api.census.gov/data/timeseries/healthins/sahie?get=NAME,IPRCAT,AGECAT,NIC_PT,NUI_PT,PCTUI_PT&for=county:*&in=state:49&time=2024&AGECAT=0&IPRCAT=0&SEXCAT=0&RACECAT=0` returned **HTTP 302**, header `X-DataWebAPI-KeyError: 1`, `Location: https://api.census.gov/data/missing_key.html`. The final page is a 200 `text/html` "Missing Key" page, not data.
   - **Discovery metadata, no key:** `https://api.census.gov/data/timeseries/healthins/sahie.json` returned **200 application/json**. Temporal `2006/2024`, `license: https://creativecommons.org/publicdomain/zero/1.0/`. This confirms the endpoint path in the doc, so its *verify* note can be cleared.
   - **Bulk, no key:** `sahie-2024-csv.zip` returned **200 application/zip**, 13.65 MB, `Last-Modified: Thu, 06 Aug 2026 13:02:36 GMT` (7:02 AM MDT). It contains `sahie_2024.csv` (111.6 MB, 85-line preamble, then header `year,version,statefips,countyfips,geocat,agecat,racecat,sexcat,iprcat,NIPR,nipr_moe,NUI,nui_moe,NIC,...,PCTUI,pctui_moe,...,state_name,county_name`). Sample row: Beaver County 2024, all ages and incomes: `NIPR=5801, NUI=630, PCTUI=10.9`.
2. **Vintage / cadence:**
   - 2024 estimates released **Aug 6, 2026**. **VERIFIED-direct** (zip Last-Modified, and the SAHIE program page lists the "2008 - 2024 SAHIE" dataset as August 2026). This matches the doc.
   - Annual cadence. Next release: "Next SAHIE Release: Summer 2027". **VERIFIED-direct** from the SAHIE_2026 brochure PDF (https://www.census.gov/content/dam/Census/programs-surveys/sahie/brochures/SAHIE_2026.pdf).
   - A "Supplemental 2023 SAHIE" file was also posted Aug 2026. **VERIFIED-direct** (directory listing).
3. **License / terms:**
   - Discovery metadata gives the license as CC0 1.0 (`https://api.census.gov/data/timeseries/healthins/sahie.json`). **VERIFIED-direct**
   - The API Terms of Service (https://www.census.gov/data/developers/about/terms-of-service.html, **VERIFIED-direct**) contain three relevant clauses:
     - Use: *"You may use the Census Bureau API to develop a service or service to search, display, analyze, retrieve, view and otherwise 'get' information from Census Bureau data."*
     - Attribution: *"All services, which utilize or access the API, should display the following notice prominently within the application: 'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.'"*
     - Endorsement: *"You may not use the Census Bureau name, or the like to imply endorsement of any product, service, or entity, not-for-profit, commercial or otherwise."*
     - The ToS also contains a Title 13 ban on re-identification.
   - **Permitted for FAS grant use: yes.** INFERENCE: nothing in the ToS bars this use, and the license is CC0. Grok also cited an ask.census.gov answer: "All U.S. Census Bureau materials… are entirely in the public domain… for the public or private use" (**VERIFIED-grok**; the exact article URL was not pinned down, so re-confirm before quoting it externally).
4. **Key / limits:**
   - **A key is now required for every data query.** **VERIFIED-direct.** Live test above, plus https://www.census.gov/data/developers/guidance/api-user-guide.Query_Limits.html: *"You can include up to 50 variables in a single API query. An API key must be used with all data queries made to the Census Data API."*
   - Census video page dated May 11, 2026: *"The Census Bureau now requires an API key for all queries made to the Census Data API."* (https://www.census.gov/library/video/2026/adrm/requesting-a-census-data-api-key.html; **VERIFIED-direct** via search snippet).
   - Metadata queries need no key. **VERIFIED-direct**
   - The old "500 queries/IP/day without a key" text still appears in a stale 2024 PDF user guide. It is **superseded**. **VERIFIED-direct:** PDF ModDate Jul 30, 2024, while the live HTML says a key is required.
   - The daily quota with a key is **unknown**.
   - Free key signup is at https://api.census.gov/data/key_signup.html. **Not signed up, per instructions.**
5. **Utah coverage:** **29/29 counties VERIFIED-direct** (bulk CSV: geocat=50, statefips=49, 3,306 county rows, 29 distinct countyfips). Rows with blank NUI: **0**. No suppression in the source. Small counties carry wide MOEs (INFERENCE from the model documentation).
6. **Changed vs doc:** the access line "Census API" now **needs a key** (the doc doesn't mention one). The endpoint path is confirmed. The vintage is unchanged.
