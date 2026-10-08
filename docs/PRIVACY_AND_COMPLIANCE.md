# Privacy and Compliance Rules (enforced in code)

*This is an engineering policy, not legal advice. Phase 6 requires a written legal opinion before real provider session data flows in.*

## Data classes
| Class | Examples | Where it may appear |
|---|---|---|
| Public | Census, HRSA, CDC, court totals | Anywhere, with source + date |
| FAS-Confidential | Case-level rows | Staff screens only, RLS by org; never in exports or board views |
| FAS-Shareable | Aggregates after suppression | Board views, exports, grant attachments |

## Rules
1. **Synthetic data only** in local, preview and any agent-accessible environment. Real data lives only in production after the Phase 6 gate.
2. **Agents never hold production credentials.**
3. **County-level geography** in all shareable outputs. No addresses, ZIP codes or tracts tied to FAS records.
4. **Small-cell suppression:** hide any count below 11, plus complementary suppression so hidden values can't be recovered from totals or other cells. Rates based on suppressed counts are hidden too.
5. **Dates:** exports and board views show month or quarter, never exact dates.
6. **Not collected:** clinical notes, diagnoses, substance-use treatment details, court documents. Store only that a court order exists and its date (provided by the family or referrer with consent).
7. **Related-party transparency:** FAS pays its sister practice, Connections Counseling Services. M6 (share of dollars to affiliated providers) always appears with average rates for affiliated vs. unaffiliated providers in board views and packets.
8. **Audit log** for uploads, edits, exports and strategy approvals.
9. **Retention:** configurable per org; deletion requests honored with an audit record.

## Legal gates before real data (Phase 6)
- HIPAA: providers are likely covered entities; session data they send is protected health information. Confirm the basis (patient authorization or other) and whether CasePilot needs Business Associate Agreements, including with Supabase, Vercel and any LLM provider that would see the data. Confirm BAA availability on the plans you choose.
- 42 CFR Part 2: avoid by never recording substance-use treatment information.
- Utah court records: juvenile court social and legal records are non-public under Utah court rules; store dates, never documents.
- Data source terms: see `docs/DATA_SOURCES.md` (KIDS COUNT non-commercial; NDACAN restricted; IBIS-PH linkage clause).

## Tests that must exist (QA)
- Suppression unit tests (including complementary suppression edge cases).
- RLS tests per role (admin, staff, board_viewer) per table.
- Export tests asserting no cell < 11, no exact dates, no case-level fields.
- Strategy-draft tests asserting every number has a resolving citation.
