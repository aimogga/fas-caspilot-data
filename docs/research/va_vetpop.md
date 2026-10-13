# VA VetPop2023 County (`jrjd-qghv`)

> Deep Research source card. Checked 2026-10-08, 12:44–13:00 MDT. **VERIFIED-direct** = seen live that day · **VERIFIED-grok** = quoted from an official page by a live-search pass, not re-fetched · **ESTIMATE** = modeled · **INFERENCE** = reasoning · **unknown** = not found. Note: the Census Data API now requires a free key for all queries.

```
SOURCE: VetPop2023 County Data, 9L — U.S. Department of Veterans Affairs (now Office of Actuarial Services)
ENDPOINT / FILE: https://www.data.va.gov/resource/jrjd-qghv.json   VERIFIED-direct 2026-10-08
AUTH: none (Socrata app token optional)   RATE LIMITS: Socrata rules (see Card 5)
LATEST VINTAGE: VetPop2023 (base 9/30/2023; projections to FY2053)   CADENCE: every 2–3 years (VERIFIED-grok)
GEOGRAPHY: county
LICENSE / TERMS: CC0 1.0 (metadata "License: https://creativecommons.org/publicdomain/zero/1.0/")   COMMERCIAL REUSE: yes
FIELDS WE USE: date, fips, county_state, age_group, sex, veterans
KNOWN LIMITS: projections; "Rounding to the nearest 1,000 is always appropriate"; must filter by date
SAMPLE CALL: https://www.data.va.gov/resource/jrjd-qghv.json?$select=fips,county_state,sum(veterans) as v&$where=starts_with(fips,'49') AND date='2026-09-30T00:00:00.000'&$group=fips,county_state
```
1. **Endpoint (VERIFIED-direct):** `GET https://www.data.va.gov/resource/jrjd-qghv.json?$limit=5` returned **200 application/json**. Sample: `{"date":"2023-09-30T00:00:00.000","fips":"01001","county_state":"Autauga, AL","state":"Alabama","age_group":"17 to 44","sex":"Female","veterans":"382"}`.
2. **Vintage (VERIFIED-direct, metadata `https://www.data.va.gov/api/views/jrjd-qghv.json`):**
   - rowsUpdatedAt **2024-09-09**, publicationDate 2025-03-06, viewLastModified **2026-08-11**.
   - **The doc's "county file updated Aug 2026" reflects a metadata edit; the data rows were last updated Sep 9, 2024.**
   - The dataset holds **31 projection dates (9/30/2023 → 9/30/2053+), 25,200 rows each**.
   - The VA page (https://www.va.gov/vetdata/veteran_population.asp, **VERIFIED-direct**) carries a transition notice: *"VA has transferred ownership of the Veteran Population Projection Model (VetPop) from the National Center for Veterans Analysis and Statistics (NCVAS) to the Office of Actuarial Services (OAS)."* Contact: oas_actuaries@va.gov.
   - Next VetPop release: unknown. **ESTIMATE** (Grok): 2026–2027.
3. **License:** metadata custom field `License: https://creativecommons.org/publicdomain/zero/1.0/`. **VERIFIED-direct.** The Socrata top-level `license` field is null, so the UI may show "unspecified" (INFERENCE; Grok notes the same). CC0 text: waiver applies "for any purpose whatsoever, including without limitation commercial" (**VERIFIED-grok**, creativecommons.org). **Free: yes. Paid: yes.** CC0 doesn't waive trademarks, so don't use VA marks.
4. **Key / limits:** none required. **VERIFIED-direct.** Socrata throttling rules apply (Card 5).
5. **Utah coverage:**
   - **29/29 VERIFIED-direct.** At date 2023-09-30 there are 29 distinct fips with Utah total veterans **129,787**. The smallest FY2026 projections are Daggett 45, Piute 105, Rich 114.
   - ⚠ **If you sum without filtering on `date`, the Utah total comes out as 3,371,140,** because all projection years get summed. **VERIFIED-direct.** Ingest must filter to a single date.
   - VA's own caveat: *"Rounding to the nearest 1,000 is always appropriate for VetPop estimates."* (dataset description, **VERIFIED-direct**). Small UT counties round to 0 (INFERENCE).
6. **Changed vs doc:** the "Updated Aug 2026" claim is metadata only. Program ownership moved to OAS. The multi-year structure isn't mentioned in the doc.
