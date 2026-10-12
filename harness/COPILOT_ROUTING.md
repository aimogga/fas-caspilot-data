# Copilot routing (Cursor + GitHub Copilot)

Status: proposed, 2026-10-12.
Goal: send small, well-specified work to the GitHub Copilot cloud agent (aimogga, Copilot Pro) so Cursor credits go to complex packets.
Current state, pending George (D-009 open): Cursor is on the $20 plan with $0 on-demand.

## Routing rule
### To Copilot
- Small or well-specified issues, expected hand-written diff ≤ ~150 lines.
- Examples: #58, #65, #67, the mockup `gen.py` cleanup.
- #57 only if it stays a static route with no session, cookie or middleware change.
- Docs and checklist PRs (not DECISIONS or acceptance criteria).
- Test-only fixes, e.g. #52, #55.
- First-pass PR review with Copilot code review, requested by hand.

### Stays on Cursor
- Complex or multi-file packets.
- New screens, layout or shell changes, and anything touching data display or trust rules (design ruling, 2026-10-12).
- Auth and sessions (#60, #63, #66), `middleware.ts`.
- Database: migrations, RLS, `pnpm test:db`.
- n8n.
- Infra and health checks (#12).
- `.github/workflows/`, the ruleset, CI, secret scan, nightly audit, staleness check.
- Real FAS data (George-gated anyway).
- Anything that needs judgment or a decision not in `docs/` or `harness/DECISIONS.md`.

### Concurrency
- George decided: at most one Cursor cloud agent plus one Copilot agent may run at once.
- The D-009 budget caps are still open.
- Never on the same packet or the same files.

## Same gates for both
- Packet is a GitHub Issue built from `grok/task_packet_template.md`.
- Copilot issues inline the spec links, AC, the 400-line cap and the files allowed (QA requirement).
- D-012: at most 400 hand-written lines, added plus deleted; one statement per line.
- QA posts `PASS @ <sha>` on every AC.
- QA's verdict on a UI PR includes its own 375px check at the head sha.
- UI PRs attach Playwright screenshots at 375, 1024 and 1440, in light and dark.
- UI PRs that touch the tablet rail (768–1023) also attach 800 screenshots.
- UI PRs with a nav attach a 375 screenshot with the nav sheet open.
- UI PRs attach the axe-core result (WCAG 2.2 AA, 0 serious/critical).
- UI PRs attach a comparison with the mockup in `docs/design/mockups/`.
- UI PRs also need `DESIGN APPROVED @ <sha>` at the same head.
- Any push voids both verdicts.
- `ci` and `secret-scan` green; the main ruleset is unchanged.
- Copilot is never a ruleset bypass actor.
- The Engineer Supervisor merges (D-013).
- George's gates (D-014, D-016) are unchanged.
- QA reviews Copilot PRs exactly like Cursor PRs.
- QA is stricter on tests that only assert presence; those fail review.
- Auth, RLS, migrations and real data stay off Copilot (QA requirement).
- Copilot code review is advisory only.
- It never replaces QA PASS or DESIGN APPROVED.

## Approve-and-run-workflows rule
- Workflows don't run on Copilot pushes until someone with write access clicks "Approve and run workflows".
- Before approving, read the diff.
- Never approve if the diff touches `.github/workflows/`, auth, migrations or secrets; close the PR instead.
- Keep the repo setting "Require approval for workflow runs" ON.
- Until approved, `ci` and `secret-scan` stay pending and the ruleset blocks merge (intended).
- Each Copilot PR gets its own board row; once its workflow runs are approved it moves Working, then Watching 1/3, 2/3, 3/3, then Ready for review.
- It is marked Done only when merged.

## Budget thresholds (Pending George, D-009 open)
Nothing below is settled: caps, model choice and thresholds are proposals until George decides D-009.
- Current understanding, pending George (open question 1): billing is in GitHub AI Credits (1 credit = $0.01); Pro includes 1,500/month (1,000 base + 500 flex).
- Monthly caps: ≤ 8 Copilot agent sessions, ≤ 10 Copilot code reviews.
- Model: Auto (10% discount) or a mid-price model; avoid the top tier.
- At 75% of credits: pause Copilot code reviews.
- At 90%: no new Copilot agent sessions until the 1st (UTC).
- Overage is $0 today; that stays the current state, pending George (D-009 open).
- Actions minutes: GitHub Pro includes 3,000/month across all aimogga private repos.
- The October pace was ~3,000/month before Copilot.
- Agent sessions and reviews use Actions minutes too.
- `copilot-setup-steps` has `timeout-minutes: 30` to cap them.
- Track after each session: AI credits and Actions minutes used, QA first-pass result.
- If the Copilot QA first-pass rate is below ~50% after a month, stop routing.

## Open questions for George (money decisions, via Chief of staff)
1. Confirm Copilot billing type (AI credits vs legacy annual premium requests).
2. Set $0 stopping budgets for AI credits and for Actions? A $0 Actions budget would also stop `ci` once minutes run out.
3. Actions-minute headroom: accept the risk, trim other repos' usage, or allow a small paid Actions budget?
4. Concurrency: decided by George (one Cursor cloud agent plus one Copilot agent at once).
5. Fill D-009 cost caps with the Copilot caps above.

## Sources
- https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals
- https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing
- https://docs.github.com/en/billing/how-tos/set-up-budgets
- https://docs.github.com/en/billing/reference/product-usage-included
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/customize-the-agent-environment
- https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions
