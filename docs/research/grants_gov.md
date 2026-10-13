# Grants.gov (`grants_gov`). Tagged **Phase 5** in DATA_SOURCES.md, included because the dispatch expected it

> Deep Research source card. Checked 2026-10-08, 12:44–13:00 MDT. **VERIFIED-direct** = seen live that day · **VERIFIED-grok** = quoted from an official page by a live-search pass, not re-fetched · **ESTIMATE** = modeled · **INFERENCE** = reasoning · **unknown** = not found. Note: the Census Data API now requires a free key for all queries.

```
SOURCE: Simpler.Grants.gov API — HHS (and legacy Grants.gov search2 as fallback)
ENDPOINT / FILE: POST https://api.simpler.grants.gov/v1/opportunities/search   VERIFIED-direct 2026-10-08 (401 without key)
                 POST https://api.grants.gov/v1/api/search2   VERIFIED-direct (200, no key)
AUTH: Simpler: API key via Login.gov (X-API-Key); search2: none
RATE LIMITS: Simpler: 60/min, 10,000/day per key; inactive keys disabled after 30 days. search2: none published
LATEST VINTAGE: live; search cached hourly (VERIFIED-grok)   CADENCE: continuous
GEOGRAPHY: national (no county dimension)
LICENSE / TERMS: CC0/public-domain project; legacy API requires an HHS non-endorsement notice   PERMITTED FOR FAS GRANT USE: yes
REQUIRED NOTICES: "This product uses the Grants.gov API but is not endorsed or certified by the U.S. Department of Health and Human Services."
SAMPLE CALL: curl -X POST https://api.grants.gov/v1/api/search2 -H 'Content-Type: application/json' -d '{"keyword":"mental health","rows":1}'
```
1. **Endpoint (VERIFIED-direct):**
   - Simpler search without a key returned **401 application/json**: `{"data":{},"errors":[],"message":"Unauthorized","status_code":401}`. This is expected.
   - Legacy search2 returned **200 application/json**: `{"errorcode":0,"msg":"Webservice Succeeds",...,"hitCount":738,"oppHits":[{"id":"361521","number":"PAR-27-008","title":"Advanced Laboratories for Accelerating the Reach and Impact of Treatments ... (ALACRITY) Research Centers","agencyCode":"HHS-NIH11",...}]}`.
2. **Vintage:** live data. Simpler search is cached hourly; `/v1/extracts` provides bulk extracts (**VERIFIED-grok**, wiki/OpenAPI).
3. **License:**
   - Simpler: GitHub LICENSE says *"You can copy, modify, distribute, and perform the work, even for commercial purposes, all without asking permission."* (**VERIFIED-grok**). It covers the software project; no separate data license is posted (**VERIFIED-grok**).
   - Legacy API ToS (https://www.grants.gov/api/terms-conditions, **VERIFIED-direct**): *"You may use the Grants.gov API to search, display, analyze, retrieve, view and otherwise 'get' information from grants data."* Required notice: *"This product uses the Grants.gov API but is not endorsed or certified by the U.S. Department of Health and Human Services."*
   - **Permitted for FAS grant use: yes** (INFERENCE: no use restriction, U.S. Government data).
4. **Key / limits:** https://simpler.grants.gov/developers (**VERIFIED-direct**): *"Inactive API keys are automatically disabled after 30 days without use."* and *"by default, 60 requests per minute and 10,000 requests per day per key."* This matches the doc. Legacy search2: *"Authentication and authorization is not required for search2"* (**VERIFIED-grok**). No numeric limit is published, and HHS may block or terminate at will.
5. **Utah coverage:** not applicable (national opportunity catalog).
6. **Changed vs doc:** none. A keyless search2 endpoint is a usable fallback if the Simpler key lapses.
