# Utah Courts caseload statistics (AOC)

> Deep Research source card. Checked 2026-10-08, 12:44–13:00 MDT. **VERIFIED-direct** = seen live that day · **VERIFIED-grok** = quoted from an official page by a live-search pass, not re-fetched · **ESTIMATE** = modeled · **INFERENCE** = reasoning · **unknown** = not found. Note: the Census Data API now requires a free key for all queries.

```
SOURCE: Utah Courts Caseload – Statewide Case Filings — Utah Administrative Office of the Courts
ENDPOINT / FILE: https://www.utcourts.gov/content/dam/stats/Yearly%20Filing%20Counts%202010-2026.xlsx   VERIFIED-direct 2026-10-08
  (page: https://www.utcourts.gov/en/court-records-publications/publications/court-statistics.html)
AUTH: none        RATE LIMITS: none published
LATEST VINTAGE: FY2026 (Jul 2025–Jun 2026)   CADENCE: annual after FY close (ESTIMATE)
GEOGRAPHY: county, district, court location
LICENSE / TERMS: no license posted; UCJA 4-202.02 classifies statistics as public records   PERMITTED FOR FAS GRANT USE: unclear (FLAG: confirm with the AOC)
REQUIRED NOTICES: None stated by the source (no license or notice posted); attribute Utah State Courts.
FIELDS WE USE: Fiscal Year, District, County, Court Type, Location, Category, Case Type, Filing Count
KNOWN LIMITS: Excel only; 105 blank counts; "Statewide" pseudo-county for appellate
SAMPLE CALL: curl -sO -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0' 'https://www.utcourts.gov/content/dam/stats/Yearly%20Filing%20Counts%202010-2026.xlsx'  (plain curl UA gets HTTP 406)
```
1. **Endpoint (VERIFIED-direct):**
   - Page returned **200 text/html**. A guessed older path, `/en/about/courts/statistics.html`, returned **404**, so use the URL above.
   - Excel returned **200 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet**, 1,590,269 B, `Last-Modified: Wed, 22 Jul 2026 19:25:18 GMT` (1:25 PM MDT). It has one sheet, `All`, 41,708 data rows. Header: `Fiscal Year | District | County | Court Type | Location | Category | Case Type | Filing Count`. Sample: `2010 | District 1 | Box Elder | District | Brigham City | Judgments | Abstract of Judgment | 131`.
2. **Vintage:** FY2010–FY2026. **VERIFIED-direct.** FY2026 has 2,328 rows and 725,767 total filings; FY2025 has 713,816. The page link text reads "FY2010 - FY2026 filings - Excel". This matches the doc. Cadence: annual (**ESTIMATE**; no cadence is published).
3. **License:**
   - **No license, copyright notice, or reuse clause** on the page or in the workbook. **VERIFIED-direct** (page) and **VERIFIED-grok** (workbook strings).
   - UCJA Rule 4-202.02 (effective 5/18/2026, https://legacy.utcourts.gov/rules/view.php?type=ucja&rule=4-202.02, **VERIFIED-direct**): *"(1) Presumption of Public Court Records. Court records are public unless otherwise classified by this rule."* Public records include *"(2)(GG) statistical data derived from public and non-public records but that disclose only public data"* and *"(2)(W) publications of the Administrative Office"*.
   - Courts privacy policy (https://www.utcourts.gov/en/about/administration/privacy-policy.html, **VERIFIED-direct**): *"Public records are provided to anyone who asks, and some public records are posted on this website."*
   - **Permitted for FAS grant use: unclear** (public record, so free access; INFERENCE). These rules govern *access*, not copyright. Utah state works are not automatically public domain (17 U.S.C. §105 is federal-only). GRAMA 63G-2-201(11) lets an entity control duplication of IP it licenses (**VERIFIED-grok**). The utah.gov portal disclaimer limits free reuse to "personal or informational use" (search snippet; it is not clearly binding on utcourts.gov).
   - **Risk: medium.** Recommend written confirmation from the AOC (courtdatarequest@utcourts.gov appears in the 2025 annual report). See Flags.
4. **Key / limits:** none. No API, Excel only. **VERIFIED-direct**
5. **Utah coverage:** **29/29 counties plus "Statewide"** (appellate) in FY2026. **VERIFIED-direct**
   - **No small-count suppression.** 565 FY2026 rows have counts under 5; the minimum is 0. **VERIFIED-direct**
   - 105 blank Filing Count cells (e.g., FY2020 Adjudication of Marriage), not a documented suppression code. **VERIFIED-direct**
   - Court types: District, Justice, Juvenile, Appellate.
6. **Changed vs doc:** none in substance. The doc's "*verify* bulk reuse terms" remains **open**: no terms exist, so the reuse risk for FAS grant use stands.
7. **Re-check 2026-10-12 ~11:08 PM MT, data VERIFIED-direct:** with a browser User-Agent the workbook returns **HTTP 200** (xlsx, 1,590,269 B, `Last-Modified: Wed, 22 Jul 2026 19:25:18 GMT`). The plain curl User-Agent gets **406**, so that's bot filtering, not a dead link. Sheet `All` has columns Fiscal Year, District, County, Court Type, Location, Category, Case Type, Filing Count, starting FY2010. The Wayback Machine has no snapshot of this file, only earlier workbooks (e.g. `Yearly Count Filings FY2014-2025.xlsx`, 2025-09).
8. **Terms: still a gap.** The workbook has no license, copyright or reuse text, and I found no terms page (guessed legal/policy URLs return 404). **Permitted for FAS grant use stays unclear**; get written confirmation from the AOC.
