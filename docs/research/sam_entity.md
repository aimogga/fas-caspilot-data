# SAM.gov Entity API (GSA)

> Deep Research source card. Checked 2026-10-12, ~10:55 PM MT from the box; re-checked 2026-10-17. **VERIFIED-direct** = seen live that night · **TODO** = not yet verified from public sources; must be checked before use.

```
SOURCE: SAM.gov Entity Information API — General Services Administration
ENDPOINT / FILE: https://api.sam.gov/entity-information/v3/entities?ueiSAM={UEI}   VERIFIED-direct 2026-10-17 (HTTP 200 with key)
AUTH: SAM.gov public API key, sent as header X-Api-Key (env var SAM_API_KEY; never in code or URLs)   RATE LIMITS: per-key daily quota set by SAM.gov (not measured)
LATEST VINTAGE: live registry   CADENCE: live; registrations renew yearly
GEOGRAPHY: entity (UEI)
LICENSE / TERMS: U.S. Government data (17 U.S.C. §105; INFERENCE: public domain); public registration fields only   PERMITTED FOR FAS GRANT USE: yes
REQUIRED NOTICES: none found
FIELDS WE USE: ueiSAM, legalBusinessName, registrationStatus, registrationExpirationDate, purposeOfRegistrationDesc
KNOWN LIMITS: needs a key tied to a SAM.gov user; quota per key
SAMPLE CALL: curl -s -H "X-Api-Key: $SAM_API_KEY" "https://api.sam.gov/entity-information/v3/entities?ueiSAM=CZ9FYJUKH2S9"
```
1. **FAS registration (VERIFIED-direct 2026-10-17):** the sample call returned **200**, `totalRecords: 1`:
   - **UEI CZ9FYJUKH2S9**, legal name **FAMILY ADVOCACY SERVICES**, Salt Lake City, UT.
   - `registrationStatus: Active`. Registered **2026-09-15**, expires **2027-09-15**, last updated 2026-09-16.
   - Purpose: **Federal Assistance Awards**, the registration federal grants require. No CAGE code, as expected for an assistance-only registration.
2. **Without a key:** the endpoint answers 404, so a missing or expired key looks like "not found". Check the key first when debugging.
3. **USAspending:** no recipient records under this UEI yet (2026-10-17). That's expected for an organization with no direct federal awards so far.
4. **What to watch:** the registration must be renewed before **2027-09-15**, or FAS can't receive federal grants. Worth a reminder about 60 days ahead (George to decide; an n8n alert would fit).
5. **Status:** verified. The key came from George (environment variable `SAM_API_KEY`); the UEI is public.
