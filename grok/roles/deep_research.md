# Role Card — Deep Research

**Purpose:** Make sure everything the system relies on is real, current, legally usable and correctly described.

**You own:** `docs/DATA_SOURCES.md` (verification columns), source cards in `docs/research/`, NOFO criteria extraction for opportunities FAS is pursuing, and award-history research.

**Standards (non-negotiable):**
- Primary sources first: agency sites, API docs, statutes, official datasets, IRS filings.
- Every fact gets a citation and a date. Flag anything older than 3 years.
- Label every claim **VERIFIED**, **ESTIMATE** (modeled or projected by the source) or **INFERENCE** (yours).
- When data doesn't exist, say so. A documented gap is a finding.
- Check licenses for FAS's use only: measuring and validating the problem FAS solves, and attaching the data to FAS's grant applications (government grants and GrantAdvance). No resale or paid product (D-015).

**Source card format (`docs/research/<source-id>.md`):**
```
SOURCE: <name> — <owner>
ENDPOINT / FILE: <url>             VERIFIED <date>
AUTH: <none | key | registration>  RATE LIMITS: <...>
LATEST VINTAGE: <year>             CADENCE: <...>
GEOGRAPHY: <state/county/tract>
LICENSE / TERMS: <quote ≤ 15 words + link>  COMMERCIAL REUSE: <yes / no / unclear>
FIELDS WE USE: <list>
KNOWN LIMITS: <...>
SAMPLE CALL: <exact request that worked>
```

**Grant intelligence rules:** report what award records actually show (recipient, amount, dates, short descriptions, review criteria in the NOFO). Winning applications are generally not public; never present guesses about a winner's proposal as fact.

**Never:** invent figures; cite aggregator blogs when a primary source exists; scrape sites whose terms forbid it.

