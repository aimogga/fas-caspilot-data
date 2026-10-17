# DOJ Office of Justice Programs award pages (`ojp_awards`)

> Deep Research source card. Checked 2026-10-17 from a cloud session. **VERIFIED-direct** = seen live that day · **INFERENCE** = reasoning · **unknown** = not found.

```
SOURCE: OJP award detail pages — U.S. Department of Justice, Office of Justice Programs (OVC, BJA, OJJDP, NIJ, BJS, SMART)
ENDPOINT / FILE: https://{ovc,bja,ojjdp,nij,bjs,smart}.ojp.gov/funding/awards/{award-number}   VERIFIED-direct 2026-10-17 (307 → /user/login for anonymous clients)
AUTH: pages now require sign-in; no public API      RATE LIMITS: none published; we use 1 request/second per host
LATEST VINTAGE: live award records   CADENCE: continuous
GEOGRAPHY: award (recipient city/state)
LICENSE / TERMS: U.S. Government work (17 U.S.C. §105; INFERENCE: public domain)   PERMITTED FOR FAS GRANT USE: yes, for what is public; the abstracts are not public right now
REQUIRED NOTICES: none found; cite "DOJ Office of Justice Programs" with the award number
FIELDS WE USE: "Description of original award" (abstract), award number, awardee
KNOWN LIMITS: anonymous access is redirected to sign-in, so abstracts can't be fetched; the parser is untested against a live page
SAMPLE CALL: curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://ovc.ojp.gov/funding/awards/15povc-22-gg-00810-assi
```
1. **Endpoint (VERIFIED-direct 2026-10-17):** the sample call returns **307** to `https://ovc.ojp.gov/user/login?destination=/funding/awards/15povc-22-gg-00810-assi`. That's the same as 2026-10-15. The ingest stores these rows as `not_published` with that reason, which is the right result while the redirect holds.
2. **robots.txt (VERIFIED-direct):** `ovc.ojp.gov/robots.txt` disallows `/user/login` and `/index.php/user/login`; `/funding/awards/` is allowed.
3. **Public alternative (VERIFIED-direct):** `https://www.ojp.gov/funding/explore/ojp-award-data` redirects to `/funding/ojpgrantawards`. That page offers only Tableau dashboards (`charts.ojp.usdoj.gov/t/public/views/OJPAwardsDashboardallFiscalYears/...`: by NOFO, state, state and city) and no download or API. `data.ojp.gov` didn't answer from the session. USAspending award detail (see `usaspending.md`) still gives the award description and period of performance for every OJP award.
4. **Old-style numbers:** `https://www.ojp.gov/funding/awards/2016-va-gx-0052` returned **404**. The URL rule for pre-2017 award numbers in `packages/ingest/ojp_awards` is UNVERIFIED and may need a different path.
5. **Status:** **Use (UNVERIFIED)** stays. Re-check the sample call monthly; if it returns 200, run the parser against the saved page before trusting it.
