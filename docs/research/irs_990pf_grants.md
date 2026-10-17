# IRS e-file 990-PF XML (foundation grants paid)

> Deep Research source card. Checked 2026-10-12, ~10:55 PM MT from the box. **VERIFIED-direct** = seen live that night · **TODO** = not yet verified from public sources; must be checked before use.

```
SOURCE: Form 990 series e-file data — Internal Revenue Service
ENDPOINT / FILE: https://apps.irs.gov/pub/epostcard/990/xml/2025/index_2025.csv (index), XML batches per XML_BATCH_ID   VERIFIED-direct 2026-10-12 (HTTP 200, text/csv, 93 MB)
AUTH: none                     RATE LIMITS: none published; files are large
LATEST VINTAGE: 2025 submissions (batches through 2025_TEOS_XML_12A, Last-Modified 2026-01-21)   CADENCE: batches posted through the year (index lists XML_BATCH_ID per return)
GEOGRAPHY: organization (EIN)
LICENSE / TERMS: U.S. Government work (17 U.S.C. §105; INFERENCE: public domain); Form 990-PF is a public return   PERMITTED FOR FAS GRANT USE: yes
REQUIRED NOTICES: none found; cite "IRS Form 990-PF e-file data" with the tax period
FIELDS WE USE: EIN, TAXPAYER_NAME, RETURN_TYPE=990PF, OBJECT_ID; grant recipient, amount and purpose from the XML
KNOWN LIMITS: 1–2 year lag; XML parsing effort; index is 93 MB
SAMPLE CALL: curl -s 'https://apps.irs.gov/pub/epostcard/990/xml/2025/index_2025.csv' | grep ',990PF,' | head
```
1. **Index:** header `RETURN_ID,FILING_TYPE,EIN,TAX_PERIOD,SUB_DATE,TAXPAYER_NAME,RETURN_TYPE,DLN,OBJECT_ID,XML_BATCH_ID`; rows include 990PF filers. **VERIFIED-direct.**
2. **Batch download (VERIFIED-direct 2026-10-17):** `https://apps.irs.gov/pub/epostcard/990/xml/2025/2025_TEOS_XML_12A.zip` returned **200 application/zip**, 151,835,020 B, `Last-Modified: Wed, 21 Jan 2026`. It holds 25,387 XML returns named `<OBJECT_ID>_public.xml`. The 2025 index lists **130,347** 990-PF returns.
3. **Grants-paid fields (VERIFIED-direct 2026-10-17, read from `202503259349100005_public.xml` and `202503259349100010_public.xml` in that batch):**
   - Each grant paid during the year is a `<GrantOrContributionPdDurYrGrp>`. Its children are `RecipientBusinessName/BusinessNameLine1Txt` (and `…Line2Txt`), `RecipientUSAddress/{AddressLine1Txt,CityNm,StateAbbreviationCd,ZIPCd}`, `RecipientRelationshipTxt`, `RecipientFoundationStatusTxt`, `GrantOrContributionPurposeTxt` and `Amt`.
   - The year total is `<TotalGrantOrContriPdDurYrAmt>` (the two samples have 1 and 11 grants: $120,642 and $316,691).
   - Individuals as recipients would appear as `RecipientPersonNm`. Not seen in these samples (INFERENCE from the schema). FAS should store business recipients only.
4. **Cost to ingest:** each batch is about 150 MB and must be downloaded whole. Filter by the index first (990PF and the EINs we care about), then read only those members from the zip.
