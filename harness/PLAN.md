# Build Plan

*Owner: Chief of Staff. Durations are rough estimates for a small agent team with George reviewing; the Chief of Staff replaces them with dated targets in Phase 0.*

| Phase | Goal | Features | Rough duration | Exit criteria | Gate |
|---|---|---|---|---|---|
| 0 Discovery & setup | Know our tools, decide open questions, prove Cursor Cloud works | F-000 – F-003 | ~1 week | Inventory, decisions, verified sources, working cloud environment, dated plan | George approves |
| 1 Foundation | App, database, roles, synthetic data, CI, previews | F-101 – F-105 | 1–2 weeks | All passing; preview deploy per PR | George approves |
| 2 Public data | Scheduled ingestion, freshness, need score, map | F-201 – F-211 | 2–3 weeks | 7 sources refreshing automatically; map + need score live on preview | George approves |
| 3 FAS data | Upload, forms, metrics, outcomes, suppression | F-301 – F-306 | 2–3 weeks | Golden metrics match; suppression tests green | George approves |
| 4 Visuals & exports | Team + board dashboards; PDF/DOCX packets | F-401 – F-404 | 2 weeks | Packets pass export assertions; board view prints cleanly | George approves |
| 5 Grants | Opportunities, matching, explanations, award history, strategy drafts | F-501 – F-509 | 3–4 weeks | Eval precision ≥ 70%; every draft number cited | George approves |
| 6 Hardening & launch | Audit script, security, legal gate, real data, board launch | F-601 – F-605 | 2–3 weeks + legal | Legal opinion filed; real data loaded; board launched | George approves each step |

## Working limits
- Max 2 Cursor Cloud Agents in parallel until Phase 2 exit; raise only if review keeps up.
- One feature per packet; target under ~400 changed lines.
- Phases can overlap only where features don't depend on each other (e.g., F-501 can start during Phase 4).

## Earliest useful wins (show FAS quickly)
1. Phase 2 county map + need score on the preview site (public data only, no privacy risk).
2. F-501 + F-505 grant digest (can be pulled forward right after Phase 1 if George wants alerts sooner).
