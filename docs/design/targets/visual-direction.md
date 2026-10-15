# Target look: FAS Evidence visual direction (George, 2026-10-15)

George chose the three artboards in the private design canvas "FAS Evidence visual direction" (claude.ai artifact `GRbSa1sQsLqzRpo9LDdV1Q`) as the **target look** for the Home, County need map and Board packets. Each packet's "after" shots are compared with the matching artboard; deviations are explained in the PR. All numbers on the artboards are synthetic examples: the app always shows stored values, and anything the app does not have yet renders "Not available yet", never the example number.

Shared across all three: page background warm off-white (`--background`), ink near-black (`--foreground`), one accent forest green (`--primary`, links); Inter for UI, Source Serif 4 for headlines; body 15 px / 1.45; type steps used 11 · 12 · 13 · 14 · 17 · 22 · 34 · 44 px (44 px for KPI numerals, 34 px for the page headline, 22 px serif for section headlines, 11–12 px caps for eyebrows and source lines). Map tokens to the existing CSS variables; never copy the artboard hex values into code.

Every chart and card follows one pattern: **eyebrow → serif sentence that states the finding → the picture → a source line (source · period · n · as of) → "View as table"**.

## Staff home (`/staff`, `/admin`) — packets DS-10a, DS-10b
Layout top to bottom:
1. Eyebrow with weekday and date ("THURSDAY, OCTOBER 15"), serif greeting "Good morning, <first name>", one sentence that summarises the quarter in words ("Families are getting help faster this quarter. Two things need you before Friday."), and two actions on the right: "Enter a case" (secondary) and "Upload data" (primary).
2. **Three KPI cards in a 3-column grid**: label · direction chip in words ("Better · 4 days faster", "Slower · 1 day", "Better · up 3 points") · 44 px numeral with unit ("23 days", "9 days", "71%") · source line ("Median · FAS records · Q3 2026 · n = 64 · as of Sep 30"). Cards: wait after a court order (M1), application to decision (M2), families who finished therapy (M4 completion).
3. **Two-column row**: left "Needs you · N items" list (badge in words: Blocker / Due Fri / Draft / Missing; a title; a sub-line; one action button per row: Fix rows / Update / Review / Add); right "Families helped, by month" chart card (serif finding sentence, stacked bars Court referral vs School, self or other, month axis, source line, View as table).
4. "Public sources" card: one row per source with its status in words ("Census SAHIE · current", "Utah Courts · stale 38 days", "VA VetPop · last run failed") and "Open data freshness".

## County need map (`/need-map`) — packets DS-11a, DS-11b
1. Serif question as the H1: **"Where is the need greatest?"**, then one sentence: "Each county is ranked against the other 28 on four public measures. Darker means more need. Pick a county to see why it ranks where it does."
2. View switch **Map · Ranked list · Table**, and a "Show" chip row: Overall need · Uninsured · Mental health shortage · Frequent distress · Court filings. A caption "Rank out of 26 scored · 3 not published".
3. Map: each county shows its name and "#rank" on the map; unscored counties are hatched with "Not published"; the selected county is outlined and labelled "selected". Legend in words: Lower need · Below average · Above average · Highest (top 7) · Not published. Source line under the map: need score version, weights approval month, the four sources with vintages, "26 of 29 counties scored".
4. **Selected county panel** (right column): eyebrow "SELECTED COUNTY", serif county name, population in words ("about 20,000 people"), a large rank sentence ("4th highest need of 26 counties scored."), a one-line summary ("Higher need on 3 of 4 measures than the typical Utah county."), then "How Carbon compares on each measure" with one bar per measure (bar = this county, tick = the middle Utah county), the value, and a plain verdict plus source ("Higher than most counties · Census SAHIE 2024"; "Serious shortage · HRSA, Oct 10, 2026"; "Stale, 38 days · Utah Courts FY2025"); a failed source shows "Not published · Source failed to load Oct 9. Nothing shown rather than old data." Actions: "Add to packet" and "View as table".

## Board dashboard (`/board`) — packets DS-13a, DS-13b
1. Eyebrow "BOARD · Q3 2026 · JULY TO SEPTEMBER", serif H1 **"This quarter in four pictures"**, one sentence of what is shown and the privacy rule ("County totals only. Anything under 11 families is hidden.").
2. Four numbered picture cards, each with eyebrow "1 · WHERE NEED IS HIGHEST", a serif finding sentence, a supporting sentence, the picture, the source line and View as table:
   - **1 Where need is highest**: the county map with the same legend; "Open the map".
   - **2 Who FAS served**: horizontal bars by county with counts, "4 other counties · n < 11" as one hidden band; three totals (families started, applications received, completed therapy).
   - **3 How fast families got help**: five-quarter line with a dashed "Goal 21 days" line and values on points.
   - **4 Where the money went**: one share bar (sister clinic vs other providers) plus the two hourly rates side by side; "related party disclosed" in the source line.
3. A packet card: "BOARD PACKET · READY · GENERATED <date>", "Q3 2026 packet, 6 pages, prints in black and white", next meeting line, "Download PDF" and "See earlier packets". Until a stored packet exists, the card shows the current download links (DOCX, CSV) and no invented page count or meeting date.

## How packets use this
- The designer agent opens this file in step 3 (audit) and lists every gap between the current page and its artboard in the audit's "Mockup gaps" table.
- Copy from the artboards is the default wording; numbers, dates and names always come from stored rows.
- If the app lacks the data for an artboard element (a population figure, a next-meeting date, a generated-packet record), the element ships as "Not available yet" or is left out, and the gap is listed in the spec's Open questions.
