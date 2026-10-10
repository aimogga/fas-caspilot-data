# FAS Evidence: Design → Build Workflow

*Repo location: `docs/DESIGN_WORKFLOW.md` (per the Supervisor). Specs live in `docs/design/specs/<ID>.md`, one file per PR, with mockups in `docs/design/mockups/`.*
*Order confirmed by the Supervisor: PR #28 rename → DS-01a → DS-01b → DS-01c → DS-02 → DS-03 → DS-04 → F-201.*

## Steps
1. **Spec first.** Design commits `docs/design/specs/<ID>.md` (scope, files, acceptance criteria, states, a11y, line budget) before any code. An engineer starts only from a merged or linked spec.
2. **One packet, one agent, one PR.** Only one cloud agent works at a time. The hand-written diff stays at 400 lines or fewer (D-012: lockfiles and generated files are excluded but listed by name). The PR body links the spec and maps each acceptance criterion to its evidence.
3. **Evidence on the PR:**
   - Playwright screenshots at **375, 1024 and 1440** wide (plus print, where relevant); UI PRs with a nav add a 375 shot with the mobile nav sheet open;
   - an axe-core result;
   - for UI PRs, a comparison with the referenced mockup.
4. **Design review.** Design posts exactly one of these on the PR, naming the head sha:
   - `DESIGN APPROVED @ <sha>`
   - `DESIGN CHANGES @ <sha>` followed by a numbered list

   Any new push voids the verdict, and design reviews again.
5. **QA.** QA posts `PASS @ <sha>` per QA_ACCEPTANCE.md.
6. **Merge gate.** The Engineer Supervisor squash-merges only when all of these hold at the *same head sha*:
   - DESIGN APPROVED;
   - QA PASS;
   - CI green (lint, typecheck, unit, db, e2e);
   - secret scan green.

   If the head moves, all four re-run.
7. **After merge.** Append to `harness/progress.md`, mark the spec "Shipped @ <merge sha>", and start the next spec in order.

## Design-review checklist
- [ ] Matches the spec scope; nothing extra. Hand-written diff ≤ 400 lines.
- [ ] Uses tokens only. No raw hex or ad-hoc px outside the scale (4/8/12/16/24/32/48/64). No inline styles.
- [ ] Type: Inter for UI, Source Serif 4 for H1/H2/display, tabular numbers for metrics.
- [ ] Brand: "FAS Evidence" type wordmark only. No CasePilot text anywhere user-visible (UI, `<title>`, metadata, emails, exports).
- [ ] States present: empty, loading (skeleton), error (plain language, no raw Supabase or env text), permission-denied (real 403 status).
- [ ] Trust rules, where data appears:
  - suppressed n<11 plus complementary suppression;
  - source + "as of" footer;
  - month or quarter dates in shared views;
  - county level only;
  - M6 always shown with rates;
  - status never by color alone.
- [ ] A11y:
  - visible `:focus-visible` ring;
  - labels above fields;
  - `role="alert"` on errors;
  - landmarks and skip link;
  - targets ≥ 24px (44px for primary);
  - axe shows 0 serious or critical issues;
  - reflows at 320px and 200% zoom.
- [ ] Responsive: 1440 desktop, 1024 tablet (sidebar becomes a 56px rail), 375 mobile (below 768px: top bar + menu button + nav sheet), print where specified.
- [ ] Mobile (375):
  - touch targets ≥ 44×44px for every tappable control (buttons, nav items, menu/close buttons, links in lists);
  - no horizontal scroll at 375 (`document.documentElement.scrollWidth <= 375`, asserted in Playwright);
  - readable type: body ≥ 15px, inputs 16px (prevents iOS zoom), H1 ≤ 28px, no text under 12px;
  - nav reachable: the menu button is visible in the top bar on every authed page, opens the role nav sheet, focus is trapped in it, Esc and ✕ close it, and focus returns to the menu button.
- [ ] Copy is sentence case, verb-first buttons, no filler or lorem.
- [ ] No purple, no gradients, no decorative icon grids.
- [ ] Screenshots attached match the mockup within reason; deviations are explained.

## References
- Design system: `/workspace/casepilot-ds/design-system-v1.md` (Doc "FAS Evidence Design System v1 — Proposal").
- Screen plan: `/workspace/casepilot-ds/fas-screen-plan.md`.
- Mockups: `/workspace/casepilot-ds/mockups/*.png`, HTML sources in `mockups/src/`.
