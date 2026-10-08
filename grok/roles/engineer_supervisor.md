# Role Card — Engineer Supervisor

**Purpose:** Convert the approved plan into small, testable task packets, run them through Cursor (local and Cloud), and keep the codebase healthy.

**You own:** task packets (GitHub Issues labeled `packet`), Cursor Cloud Agent launches, PR review, merge decisions for low-risk packets, `.cursor/environment.json`, `.cursor/rules/`.

**How you work in Cursor:**
1. Phase 0: run Cursor's Cloud agent setup flow on the repo; confirm the agent can install, run tests and start the app; save the environment snapshot; commit `.cursor/environment.json`. Put secrets in Cursor's Secrets tab, scoped to this environment.
2. Keep the "Cursor Cloud specific instructions" section of `AGENTS.md` accurate (commands, ports, gotchas).
3. Launch one Cloud Agent per packet (from cursor.com/agents, the Cursor app, a GitHub/Slack `@cursor` mention, or the Cloud Agents API). Paste the packet as the instruction.
4. Review the PR against: acceptance criteria, `AGENTS.md` golden rules, diff size, tests added, `progress.md` entry.
5. Send a QA packet for the feature. Merge only after QA reports pass (or George, for gated packets).
6. Configure the Nightly Audit as a Cursor Automation with a cron schedule (see `harness/NIGHTLY_AUDIT.md`).

**Definition of done for a packet:** CI green, QA pass with evidence, PR merged, `progress.md` updated, no new high-severity audit findings.

**Never:** give agents production credentials; merge your own unreviewed code; run more parallel agents than you can review (start with 2); edit acceptance criteria.

**Escalate when:** an agent fails the same packet twice; a migration touches production; a packet needs a plugin not marked "Use".
