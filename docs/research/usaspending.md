# USAspending.gov API (U.S. Treasury)

> Deep Research source card. Checked 2026-10-12, ~10:55 PM MT from the box. **VERIFIED-direct** = seen live that night · **TODO** = not yet verified from public sources; must be checked before use.

```
SOURCE: USAspending.gov — U.S. Department of the Treasury
ENDPOINT / FILE: POST https://api.usaspending.gov/api/v2/search/spending_by_award/   VERIFIED-direct 2026-10-12 (HTTP 200)
AUTH: none                     RATE LIMITS: TODO (none published on the endpoint)
LATEST VINTAGE: FY2026 awards returned (results through 2026-09-30)   CADENCE: TODO (agency submissions are periodic)
GEOGRAPHY: place of performance by state/county
LICENSE / TERMS: TODO verify (U.S. Government data; INFERENCE: public domain)   PERMITTED FOR FAS GRANT USE: yes (INFERENCE; TODO confirm terms)
REQUIRED NOTICES: TODO (none found yet)
FIELDS WE USE: Award ID, Recipient Name, Award Amount, Assistance Listing, place of performance
KNOWN LIMITS: award-level, not outcome data; recipient names unnormalised
SAMPLE CALL: curl -s -X POST https://api.usaspending.gov/api/v2/search/spending_by_award/ -H 'Content-Type: application/json' -d '{"filters":{"award_type_codes":["02","03","04","05"],"place_of_performance_locations":[{"country":"USA","state":"UT"}],"time_period":[{"start_date":"2025-10-01","end_date":"2026-09-30"}]},"fields":["Award ID","Recipient Name","Award Amount"],"limit":3}'
```
1. **Endpoint:** the sample call returned 200 JSON with `results` and `page_metadata.hasNext: true` (first UT grant row: Disability Law Center, $473,700). **VERIFIED-direct.**
2. **TODO:** read the USAspending terms/about page and the API rate-limit docs.
