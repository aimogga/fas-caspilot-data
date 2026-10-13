# IRS e-file 990-PF XML (foundation grants paid)

> Deep Research source card. Checked 2026-10-12, ~10:55 PM MT from the box. **VERIFIED-direct** = seen live that night · **TODO** = not yet verified from public sources; must be checked before use.

```
SOURCE: Form 990 series e-file data — Internal Revenue Service
ENDPOINT / FILE: https://apps.irs.gov/pub/epostcard/990/xml/2025/index_2025.csv (index), XML batches per XML_BATCH_ID   VERIFIED-direct 2026-10-12 (HTTP 200, text/csv, 93 MB)
AUTH: none                     RATE LIMITS: none published; files are large
LATEST VINTAGE: 2025 submissions (batches through 2025_TEOS_XML_12A)   CADENCE: TODO (monthly batches per the index)
GEOGRAPHY: organization (EIN)
LICENSE / TERMS: TODO verify (U.S. Government data; INFERENCE: public domain)   PERMITTED FOR FAS GRANT USE: yes (INFERENCE; TODO confirm)
REQUIRED NOTICES: TODO (none found yet)
FIELDS WE USE: EIN, TAXPAYER_NAME, RETURN_TYPE=990PF, OBJECT_ID; grant recipient, amount and purpose from the XML
KNOWN LIMITS: 1–2 year lag; XML parsing effort; index is 93 MB
SAMPLE CALL: curl -s 'https://apps.irs.gov/pub/epostcard/990/xml/2025/index_2025.csv' | grep ',990PF,' | head
```
1. **Index:** header `RETURN_ID,FILING_TYPE,EIN,TAX_PERIOD,SUB_DATE,TAXPAYER_NAME,RETURN_TYPE,DLN,OBJECT_ID,XML_BATCH_ID`; rows include 990PF filers. **VERIFIED-direct.**
2. **TODO:** confirm the XML batch download path and the grants-paid schedule fields.
