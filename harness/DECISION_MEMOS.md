# Decision Memos: D-001 to D-010

> Phase 0, F-001. Written by the Chief of Staff on 2026-10-08 (MT). Options, recommendation, cost and risk for each decision. George's decisions and dates are recorded in `harness/DECISIONS.md`, which is the source of truth where the two differ.
> Sources: `harness/DECISIONS.md` (re-read in full), `grok/01_chief_of_staff_kickoff.md`, `grok/roles/*.md`, `grok/task_packet_template.md` (commit bc9a07d), plus `docs/*.md`, `harness/*.md` and `harness/feature_list.json`, all read via cursor-github on 2026-10-08. Every price was read from public pages on **2026-10-08**; the URLs are listed per memo. **ESTIMATE** = my modelling, not a published price. This is not legal advice. Items marked **⚖ Legal review** go to the F-603 legal opinion.

---

## D-001 Account and repo ownership

> **DECIDED by George, 2026-10-08: A**, per recommendation (CasePilot-owned GitHub org, Vercel team and Supabase org under casepilot.io identities). Matches `harness/DECISIONS.md` D-001. Selling the data or a paid product is ruled out by D-015.
**Question:** Under whose accounts do the code, hosting and database live?
**Options:** (A) CasePilot-owned GitHub org, Vercel team and Supabase org under casepilot.io identities. (B) Keep George's personal accounts (`aimogga` repo, Vercel team "aimogga's projects") through Phase 5, then transfer before Phase 6. (C) ModernLine accounts.
**Recommendation: A** (original timing "before F-003" is superseded: F-003 is already set up on the current repo, so the move is planned before Phase 6). Create a free GitHub org for CasePilot and move `fas-caspilot-data` into it (GitHub keeps issues and PRs and redirects old URLs). Fix the "caspilot" typo at the same time if it's unintended. Then create the Vercel team and Supabase org under casepilot.io. Cursor's Cloud setup, the Vercel Git link and the Supabase GitHub integration all bind to the repo path, so moving after F-003 or F-105 means redoing them. **Rule out C:** it mixes another client's tooling and credentials into this project (D-007 notes Cursor's MCP already points at ModernLine's n8n).
**Cost:** GitHub Free org $0 (unlimited private repos, 2,000 Actions min/mo; Team is $4/user/mo) ([docs.github.com plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [github.com/pricing](https://github.com/pricing)). Vercel and Supabase cost the same under either owner (see D-006). Transfer effort is ~1–2 hours (ESTIMATE).
**Risk:** If the code stays personal it's harder to transfer or audit, and a personal-account compromise exposes the product. The transfer itself is low risk if done before the integrations exist.
**Needed from George:**
1. Approve A.
2. Name the org and the casepilot.io admin identity.
3. **Open question, not a fact:** you said your personal GitHub owns `casepilot-fas-proof`. cursor-github cannot see `aimogga/casepilot-fas-proof` or `mogga1991/casepilot-fas-proof` (both return "not accessible", checked 2026-10-08). It may be private and not granted to Cursor's GitHub App, or it may not exist. Which repo is canonical? Today the working repo is `aimogga/fas-caspilot-data`.
4. Which of the three Vercel connectors to keep. Only `user-Vercel-xai` resolves, to "aimogga's projects".

## D-002 Scheduler for data pulls and alerts

> **DECIDED by George, 2026-10-08:** **A**, per recommendation, including the inactive-by-default and no-edits-to-live-workflows rules (DECISIONS.md D-002).
**Question:** What triggers the ingest code and sends alerts and the digest?
**Options:** (A) n8n at n8n.casepilot.io triggers the repo's ingest functions and sends alerts and the digest. (B) Supabase Cron (pg_cron) + Edge Functions only. (C) GitHub Actions cron.
**Recommendation: A, conditional.** The acceptance criteria for F-201 to F-208 and F-505 already say "n8n", and changing them needs your approval. Ingest logic stays in `packages/ingest/` either way. **Conditions to confirm before Phase 2:**
1. The instance really is self-hosted on CasePilot's GCP (not n8n Cloud).
2. Its region and execution-data retention.
3. A dev-only credential and a dev workflow folder that are separate from any live workflows.

**Fallback is B,** which adds no vendor and costs nothing extra on Supabase Pro. If B is used, change the "Scheduled in n8n" criteria. C is fine for CI but weak as a production scheduler: scheduled runs can be delayed, and it adds a third place where secrets live.
**Cost:** Self-hosted n8n Community Edition is free; the existing VM's marginal cost is about $0 (**unverified**, I can't see the GCP bill). n8n Cloud is €24/mo Starter or €60/mo Pro ([n8n.io/pricing](https://n8n.io/pricing/), [docs.n8n.io](https://docs.n8n.io/choose-how-to-use-n8n.md)). B is included in Supabase Pro (Edge Functions: 2M invocations/mo included) ([Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)). C uses part of the 2,000 free Actions minutes.
**Risk:** n8n saves execution payloads by default, so alerts must carry run IDs, never data rows. If n8n turns out to be n8n Cloud, n8n GmbH becomes a third-party processor. Also, the Grants.gov key is disabled after 30 days unused, so whichever scheduler runs it has to keep it alive.
**Needed from George:**
1. Confirm the hosting, region and retention of n8n.casepilot.io.
2. Approve A with B as the fallback.
3. Who receives failure alerts (email or Slack).

## D-003 In-app LLM provider for strategy drafts

> **DECIDED by George, 2026-10-08:** per recommendation: 5-opportunity bake-off scored by QA on citation accuracy; keep the `lib/llm/` adapter (DECISIONS.md D-003).
**Question:** Which model API powers F-508 (cited strategy drafts) behind `lib/llm/`?
**Options:** (A) xAI Grok API. (B) Anthropic. (C) OpenAI. In every case it sits behind the adapter.
**Recommendation:** Keep the bake-off, but set the rules now:
- Run it in Phase 5 on public data and synthetic aggregates only, on 5 opportunities, scored by QA for citation accuracy and valid JSON.
- Only shortlist providers that offer **both** a BAA path and zero data retention (ZDR). All three do today.
- Default candidate: xAI `grok-4.7` on the US regional endpoint, which guarantees US processing and storage for that model. ZDR is self-serve.

**Cost:** About $0.09–0.11 per draft (ESTIMATE: 30k input + 4k output tokens). Pricing: xAI grok-4.7 is $2/$6 per M tokens, or $2.20/$6.60 on the US endpoint ([docs.x.ai pricing](https://docs.x.ai/developers/pricing)). Claude Sonnet 5.5 is $2/$10 and GPT-5.6 Terra is $2/$12, both as listed at API rate on [cursor.com/docs/account/pricing](https://cursor.com/docs/account/pricing); confirm on each provider's own page. With retries and 50 drafts/mo, that's **under $25/mo**.
**Risk:**
- By default, xAI keeps API data for 30 days ([docs.x.ai security FAQ](https://docs.x.ai/developers/faq/security)). xAI enterprise terms forbid sending PHI without a BAA and the ZDR-enabled API ([x.ai enterprise ToS](https://x.ai/legal/terms-of-service-enterprise)).
- Anthropic: HIPAA readiness and ZDR are separate modes in one org ([Anthropic retention docs](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)). OpenAI needs a BAA plus Modified Retention ([OpenAI HIPAA help](https://help.openai.com/en/articles/20001069)).
- The design sends only suppressed aggregates. **⚖ Legal review:** whether those aggregates count as de-identified, and so whether a BAA is needed at all.

**Needed from George:**
1. Approve the bake-off rules.
2. Which provider accounts may be used, and whose billing.
3. Confirm the **build agents** (Grok, Cursor's model providers) are in scope for the same review.

## D-004 PDF and Word export method

> **DECIDED by George, 2026-10-08:** **A**, per recommendation (DECISIONS.md D-004).
**Question:** How do we produce the F-403/F-404 packets?
**Options:** (A) Print-optimised HTML route → PDF with headless Chromium, plus a DOCX library. (B) A React PDF library (a separate layout to maintain). (C) A paid document API.
**Recommendation: A.** There's one design source for screen and print, Playwright already renders the page for QA snapshots, and no third party sees packet data. **Do not choose C.** It sends FAS-Shareable packets to an outside processor and would need a decision and BAA review of its own.
**Cost:** A and B are $0 in licences. Chromium runs as a Vercel Function, which adds compute that falls inside the D-009 Vercel cap (ESTIMATE: a few cents per month at board-packet volumes). C would cost DocRaptor $15–75/mo for 125–1,250 docs ([docraptor.com/plans](https://docraptor.com/plans)) or PDFShift $9–24/mo ([pdfshift.io/pricing](https://pdfshift.io/pricing/)).
**Risk:** Chromium's bundle size and cold starts on serverless functions. Mitigate with a slim Chromium build and a spike task in Phase 4 before committing. DOCX parity with the PDF is the harder half. F-404 has to check that the file opens cleanly in Word and Google Docs.
**Needed from George:** Approve A.

## D-005 Outcome questionnaires (FAS leadership decision)

> **DECIDED by George, 2026-10-12:** PHQ-9 and GAD-7 now, built as a pluggable instrument registry so OQ-45 and Y-OQ can be added later without schema rework. Store total scores only. The need-score weights are still open. The recommendation below is the superseded proposal.
**Question:** Which outcome measures does FAS collect for O1?
**Options:** (A) OQ-45.2 (adults) + Y-OQ (youth). (B) PHQ-9 + GAD-7. (C) Accept whatever each provider already gives.
**Recommendation: A, if FAS can get scores from providers who already license the OQ.** Utah's FY2025 public Mental Health Treatment Scorecard reports client outcomes "through OQ" ([sumh.utah.gov scorecards](https://sumh.utah.gov/data-reports/scorecards/); youth PDF checked 2026-10-08). Optum Salt Lake County's Medicaid provider manual reportedly requires OQ/Y-OQ via OQ-Analyst ([manual PDF](https://www.optumhealthslco.com/content/dam/noindex-resources/slco/providers/manuals-guidelines-policies/provider-manual-slco.pdf); from a search summary, I didn't read the PDF myself), so many FAS providers may already administer it. Ask before buying a licence. If they don't, **B** is free: no permission is needed to reproduce or distribute ([phqscreeners.com](https://www.phqscreeners.com/select-screener)). The cost is losing the comparison with Utah's scorecard.
**Cost:** OQ licences are quoted per case. Published reference points: $250 per FTE seat per year (unlimited administrations, three instruments). The basic licence covers up to 200 clients a year. There's no nonprofit discount, and paper licences exclude electronic use ([oqmeasures.com OQ-45.2](https://www.oqmeasures.com/oq-45-2/), [FAQ](https://www.oqmeasures.com/faqs/), [licensing](https://www.oqmeasures.com/pricing-3/)). PHQ-9/GAD-7 cost $0. The app cost is the same either way (F-305 supports all four).
**Risk:**
- Outcome scores are health information. Store **total scores only**, never item-level answers (PHQ-9 item 9 asks about self-harm).
- Asking OQ Measures whether storing totals in our app needs a licence is a question for them, not a legal conclusion.
- **⚖ Legal review:** these scores are probably the most sensitive field in the product.

**Needed from George / FAS leadership:**
1. Ask FAS's providers, including Connections Counseling, whether they already run OQ/Y-OQ.
2. Then choose A or B.

## D-006 Hosting plans and compliance tier

> **DECIDED by George, 2026-10-12:** George's current paid Vercel plan plus Supabase Pro (Supabase up to $60/mo, per D-009). The cost figures below are superseded proposals.
**Question:** Which Supabase and Vercel plans and region now, and what has to change before real data arrives?
**Options:**
- (A) Free tiers through Phase 5.
- (B) **Supabase Pro + Vercel Pro through Phase 5,** compliance tier decided at Phase 6.
- (C) Compliance tier now: Supabase Team + HIPAA add-on, Vercel Pro + BAA.

**Recommendation: B.**
- **Vercel Hobby is personal and non-commercial only.** A CasePilot product, even one given free, fits the commercial definition ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines.md), [Hobby plan](https://vercel.com/docs/plans/hobby)).
- **Supabase Free** limits you to 2 projects and pauses projects after about a week of low activity ([Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing)). That's a bad fit for nightly ingest and for separate preview and production databases.
- **Region:** put Supabase in a US-West region and pin Vercel Functions to the matching region.

C is premature with synthetic data only.
**Cost:**
- **Phases 0–5, about $55–70/mo:** Supabase Pro $25 + about $10 for a second Micro project (Pro includes $10 compute credit; branching is $0.01344 per branch-hour) ([supabase.com/pricing](https://supabase.com/pricing)). Vercel Pro $20 with $20 usage credit included ([Vercel Pro](https://vercel.com/docs/plans/pro-plan)).
- **Phase 6 if PHI is hosted, about $1,400+/mo (ESTIMATE):**
  - Supabase Team, from $599.
  - HIPAA add-on: price **unpublished**; a forum report puts it at about $350.
  - PITR, which HIPAA projects require: from $100.
  - Vercel HIPAA BAA, $350/mo self-serve on Pro ([Vercel pricing](https://vercel.com/docs/pricing), [Supabase HIPAA](https://supabase.com/docs/guides/platform/hipaa-projects)).

**Risk:** That Phase 6 figure is real money for a product given free. A cheaper route is to keep PHI out of the hosted stack entirely: aggregate-only intake (F-303), or de-identified case rows. **⚖ Legal review:**
- Whether FAS is a covered entity, and whether CasePilot would be its business associate.
- Whether aggregate-only intake avoids BAAs.
- 42 CFR Part 2: the design avoids it by never recording substance-use treatment. Enforce that with no free-text fields on `non_start_reason` and similar.
- Utah juvenile court records: whether storing `court_involved` and `court_order_date` for juveniles is allowed when the family or referrer supplies them.

**Needed from George (decided 2026-10-12, see above):**
1. ~~Approve B~~ decided: paid Vercel + Supabase Pro.
2. Pick the region.
3. Start the legal opinion **now** in parallel; its answer decides whether Phase 6 costs about $70/mo or about $1,400+/mo.

## D-007 Cursor and MCP configuration

> **DECIDED by George, 2026-10-08:** per recommendation (DECISIONS.md D-007).
**Question:** Which MCP servers can local agents, Cloud Agents and Automations use, and with what credentials?
**Options:**
- (A) The doc's recommendation as written, with the n8n MCP repointed to CasePilot.
- (B) **Least-privilege matrix:**
  - **Local:** Supabase MCP (dev project, read-only by default; writes only against local `supabase start`), Vercel MCP (preview), shadcn, Context7, Playwright.
  - **Cloud Agents:** Context7, shadcn, Playwright, and Supabase MCP read-only on dev. No Vercel or n8n MCP.
  - **Automations:** read-only Supabase advisors on dev, plus GitHub.
- (C) No MCPs at all in the cloud.

**Recommendation: B.**
- Commit a project-level `.cursor/mcp.json` that references env vars and contains no secrets, so this repo stops inheriting the ModernLine n8n MCP from George's global config.
- Supabase's hosted MCP supports `project_ref=` (one project, account tools disabled) and `read_only=true` ([Supabase MCP docs](https://supabase.com/docs/guides/ai-tools/mcp)).
- Keep the n8n MCP **off** until D-002 confirms a CasePilot dev instance.
- Secrets go only in Cursor's Secrets tab, scoped to the environment.

**Cost:** $0.
**Risk:** An MCP with write tools plus untrusted web or issue content invites prompt injection. Production credentials must never be reachable. The ModernLine pointer risks crossing two clients' systems.
**Needed from George:**
1. Approve B.
2. Confirm the dev Supabase project ref and the scope of the Vercel preview token.
3. Allow the Engineer Supervisor to commit `.cursor/mcp.json`.

## D-008 Multi-organization design

> **DECIDED by George, 2026-10-08:** per recommendation (DECISIONS.md D-008).
**Question:** Do we build tenant isolation in from day one?
**Options:** (A) `org_id` on every FAS table plus RLS by org and role from F-102, with no billing or self-serve signup. (B) Single-tenant now, retrofit later. (C) A separate Supabase project per organization.
**Recommendation: A.** F-102's acceptance criteria already require "policies per role and org_id". A retrofit later means rewriting every query and policy. C gives the strongest isolation but adds a project per organization; keep it as an option for a future customer that asks for physical isolation.
**Cost:** $0 extra on infrastructure. Under C, about $10/mo per extra org on Supabase Pro compute (ESTIMATE, from Pro's Micro credit model).
**Risk:** A single RLS bug could leak data across tenants, which matters most once real data lands. Mitigations: deny-by-default, `rls.test.ts` for every table and role (F-102), and the Nightly Audit check #4.
**Needed from George:** Approve A. It's quick, and it blocks F-102.

## D-009 Cost caps

> **DECIDED by George, 2026-10-12 (locked):** Cursor $60 plan with $0 on-demand. Supabase Pro, up to $60/mo. George's current paid Vercel plan. Nightly Audit under $2 per run. $25/mo for the in-app LLM, starting in the grants phase (Phase 5). From George's 7:55 PM MT relay: no cap on parallel agents; when usage runs out, work pauses and resumes after the reset. Implementation note (not George's words): the Nightly Audit runs on a GitHub Actions cron. This supersedes George's 2026-10-08 note ($20 plan, 1 Cloud Agent at a time).
> Everything below, including the "Proposed caps" table and totals, is a **superseded proposal** kept for the record.
**Question:** What are the monthly limits, and how are they enforced?
**How billing works (read 2026-10-08):**
- Cloud Agents bill at the selected model's API rate. They draw on the plan's included usage first, then on-demand usage. There's no separate VM charge.
- On-demand spend stays at $0 under D-009, so work pauses when included usage runs out and resumes after the reset ([cursor.com/help cloud agents](https://cursor.com/help/ai-features/cloud-agents), [Cursor forum, staff answer](https://forum.cursor.com/t/what-is-the-pricing-structure-for-using-cloud-agents/156843), [spend limits](https://cursor.com/docs/account/billing/spend-limits)).
- Automations are Cloud Agent runs that always use the model's **maximum** context window ([cursor.com/docs automations](https://cursor.com/docs/cloud-agent/automations)).
- Cursor's docs now say "Max Mode" only exists on legacy request-based plans, so the DECISIONS.md wording should be updated.
- Plans: Pro $20, Pro Plus $60, Ultra $200. Teams is $40/user, plus $0.25 per M tokens on third-party models ([cursor.com/docs/account/pricing](https://cursor.com/docs/account/pricing)).

**Per-run estimate (ESTIMATE):** 3M input tokens, 85% of them cache reads, plus 80k output:
- Composer 2.5: about $0.95
- Claude Sonnet 5.5: about $2.00
- Grok 4.7: about $2.65 (2× rates above 256k context, which matters for Automations)
- Claude Opus 5.5: about $3.90

Phases 1–5 have 35 features. At about 3 runs each (build, fix, QA), that's ~30 runs/mo, or **$30–120/mo** plus the audit.

**Proposed caps (superseded by the 2026-10-12 decision above):**

| Item | Phases 0–1 | Phases 2–5 | How it's enforced |
|---|---|---|---|
| Cursor plan | Pro Plus $60 (or Teams $40/seat if billed to CasePilot under D-001) | same | n/a |
| Cursor on-demand (Cloud Agents + Automations combined) | **$150/mo hard limit** | **$300/mo hard limit** | Cursor hard spend limit. Enforcement isn't instant (the docs say usage can briefly overshoot). Alert at 80% (Nightly Audit check #7) |
| Nightly Audit, per run | **≤ $2** (Composer 2.5 or Grok 4.7 non-fast; never Opus or Fast) | **≤ $0.50** after F-601 (script + summary) | **I found no per-automation cap in Cursor's docs.** Enforce through the model choice, the audit logging its own token use, and pausing it after 2 runs over cap. Monthly sub-budget $60 |
| Parallel Cloud Agents | **2** | 2; raise only if review keeps up | Engineer Supervisor rule |
| Default model for packets | Composer 2.5 / Grok 4.7 (Cursor Models pool, no token surcharge) | same; Sonnet/Opus only on a second attempt | Packet field |
| Supabase | **$60/mo** (Pro + 1 extra Micro + short-lived branches) | $60 | Spend Cap ON. **Compute and branching aren't covered by the cap, and there are no dollar alerts** ([Supabase cost control](https://supabase.com/docs/guides/platform/spend-cap)), so the Nightly Audit checks the upcoming invoice and preview branches get auto-deleted |
| Vercel | **$50/mo** ($20 Pro + $30 on-demand budget) | $50 | Spend Management: notify at 50/75/100%. Auto-pause production at the cap only while there are no real users ([Vercel spend mgmt](https://vercel.com/docs/spend-management)) |
| In-app LLM API | $0 (not built yet) | **$25/mo**; the Phase 5 bake-off is a one-off of up to $25 | Provider console limit (confirm the chosen provider supports a hard cap) |
| n8n / GitHub | $0 / $0 | $0 / $0 | Unverified for n8n's VM |
| **Total cap** | **about $320/mo** | **about $495/mo** | Phase 6 compliance tier is extra; see D-006 |

**Risk:**
- Automations at maximum context on a costly model can cost several dollars per night.
- Retries on a hard packet compound the cost.
- Caps can briefly overshoot.

**Needed from George:**
Decided 2026-10-12 (see above); nothing further needed.

## D-010 Foundation opportunity inputs

> **DECIDED by George, 2026-10-08:** per recommendation: manual + CSV in v1; check each tool's export terms before automating (DECISIONS.md D-010).
**Question:** How do foundation opportunities get in, and do the research tools' terms allow it?
**Options:** (A) Manual entry only. (B) Manual entry plus CSV import of FAS's own exports. (C) API or bulk integration with a research tool (for example a Candid API licence).
**Recommendation: B, limited to FAS's own tracked list** (the opportunities FAS saved, plus its own notes), with a terms check per tool first.
- Candid's subscriber licence allows limited exports but, per its terms, prohibits bulk download, derivative databases and AI or data-mining use ([Candid subscriber licence](https://candid.org/terms-of-service/candid-subscriber-license-agreement/); summary from search, so Deep Research should read the full text).
- Instrumentl's terms forbid storing "any significant portion of the Content" and creating derivative works ([instrumentl.com/terms-of-use](https://www.instrumentl.com/terms-of-use), read 2026-10-08).
- **Until each tool's terms are cleared, imported foundation text does not go to the in-app LLM.**
- Use public IRS 990-PF data (F-507) for history instead.

**Cost:** $0 to build (F-502 is already scoped). Candid API pricing not checked. The subscriptions FAS already pays for are unknown.
**Risk:** A terms breach could cost FAS its research subscription, and C carries the most risk. The CSV formats differ per tool, so the column-mapping step from F-301 should be reused.
**Needed from George / FAS:**
1. Which tools FAS uses (Candid, Instrumentl, GrantStation, others).
2. Approve B.
3. Approve Deep Research doing a terms check per tool.

---

## Summary

| ID | Recommendation (one line) | Monthly cost |
|---|---|---|
| D-001 | **Decided 2026-10-08: A.** Create a CasePilot GitHub org and casepilot.io Vercel and Supabase accounts; plan the transfer before Phase 6. `casepilot-fas-proof` is an open question | $0 extra (GitHub Free org) |
| D-002 | **Decided 2026-10-08.** n8n (self-hosted) as scheduler and messenger once its hosting, region, retention and dev credentials are confirmed; Supabase Cron as fallback | ~$0 marginal (unverified); n8n Cloud would be €24–60 |
| D-003 | **Decided 2026-10-08.** Phase 5 bake-off limited to providers with both BAA and ZDR; default candidate xAI grok-4.7 on the US endpoint | < $25 (ESTIMATE) |
| D-004 | **Decided 2026-10-08.** HTML → headless Chromium PDF + DOCX library; no paid document API | ~$0 (inside Vercel cap) |
| D-005 | **Decided 2026-10-12:** PHQ-9 + GAD-7 now via a pluggable instrument registry (OQ-45/Y-OQ later); total scores only | $0 (if providers already license OQ) to quote-based (published $250/FTE/yr) |
| D-006 | **Decided 2026-10-12:** George's current paid Vercel plan + Supabase Pro; start the legal opinion now | Supabase ≤ $60 (D-009); superseded proposal ~$55–70; ~$1,400+ if PHI is hosted in Phase 6 (ESTIMATE) |
| D-007 | **Decided 2026-10-08.** Least-privilege MCP matrix; project `.cursor/mcp.json`; Supabase MCP `read_only` + `project_ref`; n8n MCP off for now | $0 |
| D-008 | **Decided 2026-10-08.** `org_id` + RLS deny-by-default from F-102 | $0 |
| D-009 | **Decided 2026-10-12:** Cursor $60 plan, $0 on-demand, no parallel cap, Supabase Pro ≤ $60, current paid Vercel plan, audit < $2/run, LLM $25 from the grants phase (Phase 5); cron is an implementation note | Superseded proposal: ~$320 / ~$495 |
| D-010 | **Decided 2026-10-08.** Manual entry + CSV of FAS's own tracked list; check each tool's terms; nothing imported goes to the LLM until cleared | $0 |

**Top 3 blockers for Phase 1:**
1. **D-001 ownership:** decided 2026-10-08 (A). F-003, F-104 and F-105 are already set up on the current repo and accounts, so the move to CasePilot-owned accounts needs a plan before Phase 6 to redo those bindings.
2. **D-009 caps:** decided 2026-10-12 ($60 Cursor plan, $0 on-demand). F-003 needs a Cloud Agent run log.
3. **D-006 plan tier:** decided 2026-10-12 (paid Vercel + Supabase Pro). F-105 still needs a non-production Supabase project.

All ten are now decided: D-001 to D-004, D-007, D-008 and D-010 on 2026-10-08; D-005, D-006 and D-009 on 2026-10-12. Still open in practice: the D-006 legal opinion, which should start now and decides the Phase 6 upgrade.
