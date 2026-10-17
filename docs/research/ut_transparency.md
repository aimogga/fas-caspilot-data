# Utah state transparency site (Transparent Utah)

> Deep Research source card. Checked 2026-10-12, ~10:55 PM MT from the box; re-checked 2026-10-17. **VERIFIED-direct** = seen live that night · **TODO** = not yet verified from public sources; must be checked before use.

```
SOURCE: Transparent Utah — State of Utah
ENDPOINT / FILE: https://transparent.utah.gov/ (React app, HTTP 200); bulk data is a Google BigQuery database for approved "Super Users"   VERIFIED-direct 2026-10-17
AUTH: Super User access granted by the Transparent Utah team by email, for named Gmail accounts; queries run in your own GCP project (billing account required; 1 TB/month free)     RATE LIMITS: BigQuery quotas
LATEST VINTAGE: unknown until access     CADENCE: entities upload revenue and expense transactions at least quarterly (old.transparent.utah.gov/disclaimers.php, VERIFIED-direct)
GEOGRAPHY: TODO (payee-level)
LICENSE / TERMS: TODO   PERMITTED FOR FAS GRANT USE: unclear (TODO)
REQUIRED NOTICES: TODO
FIELDS WE USE: state payments/grants to nonprofits (payee, amount, agency, fiscal year)
KNOWN LIMITS: unaudited in-year uploads ("will not tie" to audited statements, per the disclaimers page); the public site's own backend (`tu-query-handler-…run.app`) is undocumented, so don't build on it
SAMPLE CALL: none public. Needs Super User access (George: outbound email to the state + a GCP billing account). Reference: curl -s https://old.transparent.utah.gov/how_to_become_superuser.php
```
1. **Access (VERIFIED-direct 2026-10-17):** `how_to_become_superuser.php` says *"Please send the Transparent Utah team (alexnielson@utah.gov) an email that includes your organization/department and a list of valid gmail accounts that need access to the database."* Then you *"Set up a Google Cloud Platform (GCP) billing account and project."* The free tier is *"1 TB of querying per month"*. The old site also has "Available Fields", "Example SQL Scripts" and "Query with Python/R" pages.
2. **Public site:** a React single-page app. Its bundle calls `https://tu-query-handler-prod-…a.run.app` and `assets/data/entities.json`. There's no documented export or API, so we don't scrape it.
3. **Blocked on George:** getting access needs an email sent in FAS's name and a cloud billing account (golden rules: outbound email and money go to George). Utah state works aren't automatically public domain (see ut_courts.md). Read the terms once access is granted.
4. **Status:** stays **Verify first** until George decides.
