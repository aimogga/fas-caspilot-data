# CDC PLACES County Data, 2025 release (`swc5-untb`)

> Deep Research source card. Checked 2026-10-08, 12:44–13:00 MDT. **VERIFIED-direct** = seen live that day · **VERIFIED-grok** = quoted from an official page by a live-search pass, not re-fetched · **ESTIMATE** = modeled · **INFERENCE** = reasoning · **unknown** = not found. Note: the Census Data API now requires a free key for all queries.

```
SOURCE: PLACES: Local Data for Better Health, County Data 2025 release — CDC
ENDPOINT / FILE: https://data.cdc.gov/resource/swc5-untb.json   VERIFIED-direct 2026-10-08
AUTH: none (Socrata app token optional)   RATE LIMITS: untokened = shared IP pool, throttled (429); tokened = "do not throttle" unless abusive
LATEST VINTAGE: 2025 release (BRFSS 2023; 5 measures BRFSS 2022)   CADENCE: annual; next release date unknown
GEOGRAPHY: county (tract/place/ZCTA in sibling datasets)
LICENSE / TERMS: Socrata license "Public Domain"; CDC: no logo, no endorsement   PERMITTED FOR FAS GRANT USE: yes
REQUIRED NOTICES: Attribute CDC; include a no-endorsement disclaimer; don't alter content; no CDC logo without written permission.
FIELDS WE USE: measureid DEPRESSION, MHLTH (CrdPrv/AgeAdjPrv), data_value, CIs, locationid
KNOWN LIMITS: model-based; CDC says don't rank, don't evaluate programs, don't trend
SAMPLE CALL: https://data.cdc.gov/resource/swc5-untb.json?$where=stateabbr='UT' AND measureid in('DEPRESSION','MHLTH') AND datavaluetypeid='CrdPrv'&$limit=500
```
1. **Endpoint (VERIFIED-direct):** `GET https://data.cdc.gov/resource/swc5-untb.json?$where=stateabbr='UT'&$limit=5000&$select=locationname,measureid,data_value,year` returned **200 application/json;charset=utf-8**, 2,320 rows. Sample: `{"locationname":"Carbon","measureid":"ARTHRITIS","data_value":"30.3","year":"2023"}`. The mental-health query above returned 58 rows. Sample: `Piute | MHLTH | Crude prevalence 17.1% (CI 14.9–19.5) | totalpop18plus 1221 | locationid 49031`.
2. **Vintage:**
   - Metadata (`https://data.cdc.gov/api/views/swc5-untb.json`, **VERIFIED-direct**): name *"PLACES: Local Data for Better Health, County Data, 2025 release"*, rowsUpdatedAt **2025-12-04** (matches the doc), viewLastModified 2026-09-22 (metadata only).
   - Data years: 2023 and 2022. **VERIFIED-direct**
   - CDC FAQ (Dec 11, 2025, **VERIFIED-direct**, https://www.cdc.gov/places/faqs/index.html): *"PLACES data are updated on an annual basis."* Sixth release December 2025: 35 measures on 2023 BRFSS, 5 on 2022.
   - Next release: **unknown**. **ESTIMATE:** late 2026.
3. **License:** Socrata metadata `license: {"name":"Public Domain"}`, Public Access Level "public". **VERIFIED-direct**. Grok quotes CDC's Use of Agency Materials page (https://www.cdc.gov/other/agencymaterials.html, **VERIFIED-grok**): *"Most of the information on the CDC and ATSDR websites is not subject to copyright, is in the public domain, and may be freely used or reproduced without obtaining copyright permission."* Conditions: attribute CDC, include a no-endorsement disclaimer, don't alter content, and don't use the CDC logo without written permission. **Permitted for FAS grant use: yes.**
4. **Key / limits:** none required. **VERIFIED-direct** (live hit without a token). Socrata (https://dev.socrata.com/docs/app-tokens.html, **VERIFIED-direct**): *"Currently we do not throttle API requests that are using an application token, unless those requests are determined to be abusive or malicious."* Untokened requests "may be subject to throttling" (429).
5. **Utah coverage:** **29/29 VERIFIED-direct** for every measure, including DEPRESSION, MHLTH, FOODINSECU, HOUSINSECU, LONELINESS, EMOTIONSPT, LACKTRPT. No blanked values. CDC suppresses only geographic units with fewer than 50 adults (tract/place/ZCTA); counties are unaffected (**VERIFIED-direct**, FAQ).
6. **Use caveats (VERIFIED-direct, FAQ):**
   - *"the data should not be used for ranking the overall health of any county"*
   - *"model-based local estimates should not be used to evaluate the effect of local public health programs"*
   - *"The current modeling procedure does not support using the estimates to track changes at the local level over time."*
   - These directly affect a "proof" product.
7. **Changed vs doc:** none. The doc says "Public, no restrictions," which is accurate but should add the no-logo/no-endorsement conditions and the ranking/evaluation/trend caveats.
