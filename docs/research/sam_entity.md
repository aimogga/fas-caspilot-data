# SAM.gov Entity API (GSA) — TODO

> Deep Research source card. Checked 2026-10-12, ~10:55 PM MT from the box; re-checked 2026-10-17. **VERIFIED-direct** = seen live that night · **TODO** = not yet verified from public sources; must be checked before use.

```
SOURCE: SAM.gov Entity Information API — General Services Administration
ENDPOINT / FILE: https://api.sam.gov/entity-information/v3/entities   TODO (no-key probe returned HTTP 404, inconclusive)
AUTH: api.data.gov API key (per DATA_SOURCES.md)   RATE LIMITS: TODO
LATEST VINTAGE: live registry   CADENCE: TODO
GEOGRAPHY: entity (UEI)
LICENSE / TERMS: TODO   PERMITTED FOR FAS GRANT USE: unclear (TODO)
REQUIRED NOTICES: TODO
FIELDS WE USE: FAS's UEI, registration status, expiration date
KNOWN LIMITS: needs a key; not tested
SAMPLE CALL: TODO: curl -s "https://api.sam.gov/entity-information/v3/entities?api_key=$SAM_API_KEY&ueiSAM=<FAS UEI>" (untested)
```
**Blocked (re-checked 2026-10-17):** `https://api.sam.gov/entity-information/v3/entities?ueiSAM=…` without `api_key` still answers **404** (VERIFIED-direct). This can't be verified without:
1. A SAM.gov API key. These are free but tied to a SAM.gov user account, so the account owner needs to request one.
2. FAS's UEI.

Both go through George. When a key exists, store it as a secret, `SAM_API_KEY` (never in code), and run the sample call. Status stays **Verify first**.
