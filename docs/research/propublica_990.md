# ProPublica Nonprofit Explorer API

> Deep Research source card. Checked 2026-10-12, ~10:55 PM MT from the box. **VERIFIED-direct** = seen live that night · **TODO** = not yet verified from public sources; must be checked before use.

```
SOURCE: Nonprofit Explorer — ProPublica
ENDPOINT / FILE: https://projects.propublica.org/nonprofits/api/v2/search.json, /api/v2/organizations/{ein}.json   VERIFIED-direct 2026-10-12 (HTTP 200)
AUTH: none                     RATE LIMITS: TODO
LATEST VINTAGE: TODO (follows IRS e-file releases)   CADENCE: TODO
GEOGRAPHY: organization (city/state)
LICENSE / TERMS: TODO verify ProPublica's API terms (DATA_SOURCES.md says "governed by" its terms)   PERMITTED FOR FAS GRANT USE: unclear (TODO)
REQUIRED NOTICES: TODO (likely attribution to ProPublica; confirm)
FIELDS WE USE: ein, name, city, state, ntee_code, filings
KNOWN LIMITS: third-party repackaging of IRS data; IRS lag of 1–2 years
SAMPLE CALL: curl -s 'https://projects.propublica.org/nonprofits/api/v2/search.json?q=family&state%5Bid%5D=UT'
```
1. **Endpoint:** the sample call returned 200 JSON, `total_results: 584` for Utah. **VERIFIED-direct.**
2. **TODO:** read the API terms and attribution requirements before any use in a grant application.
