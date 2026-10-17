# ProPublica Nonprofit Explorer API

> Deep Research source card. Checked 2026-10-12, ~10:55 PM MT from the box. **VERIFIED-direct** = seen live that night · **TODO** = not yet verified from public sources; must be checked before use.

```
SOURCE: Nonprofit Explorer — ProPublica
ENDPOINT / FILE: https://projects.propublica.org/nonprofits/api/v2/search.json, /api/v2/organizations/{ein}.json   VERIFIED-direct 2026-10-12 (HTTP 200)
AUTH: none                     RATE LIMITS: none published; we self-limit to 30/min
LATEST VINTAGE: TODO (follows IRS e-file releases)   CADENCE: TODO
GEOGRAPHY: organization (city/state)
LICENSE / TERMS: ProPublica Data Terms of Use (linked from the API page)   PERMITTED FOR FAS GRANT USE: yes, with citation; no raw redistribution
REQUIRED NOTICES: cite ProPublica wherever its data is published (PROPUBLICA_ATTRIBUTION in lib/grants/winner-profile.ts)
FIELDS WE USE: ein, name, city, state, ntee_code, filings
KNOWN LIMITS: third-party repackaging of IRS data; IRS lag of 1–2 years
SAMPLE CALL: curl -s 'https://projects.propublica.org/nonprofits/api/v2/search.json?q=family&state%5Bid%5D=UT'
```
1. **Endpoint:** the sample call returned 200 JSON, `total_results: 584` for Utah. **VERIFIED-direct.**
2. **Terms (VERIFIED-direct 2026-10-17):** `https://projects.propublica.org/nonprofits/api` says *"Usage constitues agreement to our Data Terms of Use"*. That page resolves to `https://projects.propublica.org/datastore/terms/` and says: *"You can't republish the raw data in its entirety or otherwise distribute the data (in whole or in part) on a stand-alone basis. You can't change the data except to update or correct it. You can't charge people money to look at the data or sell advertising specifically against it. You can't sub-license or resell the data to others. If you use the data for publication, you must cite ProPublica."* **Permitted for FAS grant use: yes.** Citing funder facts inside a grant application or evidence packet is use, not stand-alone redistribution. Every place we show them carries the ProPublica citation. Never export the raw API rows as a dataset.
3. **No match (VERIFIED-direct 2026-10-17):** a search with zero results answers **HTTP 404** with a normal JSON body (`{"total_results":0,"organizations":[],...}`), and an unknown EIN is 404 too. The ingest treats both as "not found" (#210).
