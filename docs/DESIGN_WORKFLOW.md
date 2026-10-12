# FAS Evidence: Design → Build Workflow

*Repo location: `docs/DESIGN_WORKFLOW.md` (per the Supervisor). Specs live in `docs/design/specs/<ID>.md`, one file per PR, with mockups in `docs/design/mockups/`.*
*Order confirmed by the Supervisor: PR #28 rename → DS-01a → DS-01b → DS-01c → DS-02 → DS-03 → DS-04 → F-201.*

## Source documents

- `docs/design/design-system-v1.md` (token values; DS-01a uses §4–5), `docs/design/fas-screen-plan.md` (DS-02 nav comes from §1.2), and the mockups in `docs/design/mockups/` (PNG at 375/1024/1440 plus HTML source) are maintained by UX/UI Design Bot. All four sources are merged on main (#35, #43, #44, #45, #46); `docs/design/` is the source of truth.
- The sources land in design-sources PRs, each at most 400 hand-written lines (markdown/HTML count; PNG binaries do not count), split as needed: (1) `design-system-v1.md`; (2) and (3) `fas-screen-plan.md` in two parts; (4) mockups (PNG binaries plus HTML source, split if the HTML is over 400).
- DS-01a merges only after source PR (1) is merged; DS-02 after (2), (3) and (4); DS-03 and DS-04 after (4).

## Steps
1. **Spec first.** Design commits `docs/design/specs/<ID>.md` (scope, files, acceptance criteria, states, a11y, line budget) before any code. An engineer starts only from a merged or linked spec.
2. **One packet, one agent, one PR.** At most one Cursor cloud agent plus one Copilot agent at a time, never on the same packet or files. The hand-written diff stays at 400 lines or fewer (D-012: only lockfiles and *untouched* generator output, e.g. unmodified `shadcn add` files, are excluded, and they are listed by name. Any hand edit to a generated file counts toward the 400 lines, and so does the whole file once it is edited). The PR body links the spec and maps each acceptance criterion to its evidence.
3. **Evidence on the PR:**
   - Playwright screenshots at **375, 1024 and 1440** wide (plus print, where relevant); UI PRs with a nav add a 375 shot with the mobile nav sheet open;
   - an axe-core result;
   - for UI PRs, a comparison with the referenced mockup.
4. **Design review (UI PRs only).** Docs-only, data, and backend PRs skip this step. For UI PRs, design posts exactly one of these on the PR, naming the head sha:
   - `DESIGN APPROVED @ <sha>`
   - `DESIGN CHANGES @ <sha>` followed by a numbered list

   Any new push voids the verdict, and design reviews again.
5. **QA.** QA posts `PASS @ <sha>` per QA_ACCEPTANCE.md. **For UI PRs, the QA verdict must include QA's own 375px mobile check at that head sha:**
   - no horizontal scroll at 375 (`scrollWidth <= 375`);
   - every tappable control ≥ 44×44px;
   - input text ≥ 16px;
   - labels stacked above full-width fields;
   - ≥ 16px side padding on login and all pages;
   - nav reachable through the menu button and sheet.

   A UI PR cannot get QA PASS without this check; design's mobile review does not replace it.
6. **Merge gate.** Anyone George allows to merge (the Engineer Supervisor, QA, or an engineer, per D-013) squash-merges after QA PASS, and only when all of these hold at the *same head sha*:
   - DESIGN APPROVED (UI PRs only);
   - QA PASS (including the 375px mobile check for UI PRs);
   - CI green (lint, typecheck, unit, db, e2e);
   - secret scan green.

   If the head moves, all of them re-run.

   All existing gates still apply and this workflow adds to them; it never replaces them:
   - **D-012:** 400-line cap.
   - **D-013:** who merges; QA PASS on every acceptance criterion at the current head.
   - **D-014:** after QA PASS and a working preview, production deploys and migrations may proceed without George.
   - **BLOCKED — needs George:** money or plan decisions (through Chief of staff), real FAS data, outbound email, and any acceptance-criteria change. Mark the PR BLOCKED, and do not merge until George decides.
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
  - tap targets ≥ 44×44px on mobile for every control (no smaller exceptions); on desktop (≥ 1024px), sm/default buttons may be 32/40px through responsive classes only;
  - WCAG 2.2 AA throughout: text contrast ≥ 4.5:1, large text and UI components/focus rings ≥ 3:1, in light and dark;
  - axe shows 0 serious or critical issues;
  - reflows at 320px and 200% zoom.
- [ ] Responsive: 1440 desktop, 1024 desktop-min (full 256px sidebar from 1024 up), tablet 768–1023 (56px rail), 375 mobile (below 768px: top bar + menu button + nav sheet), print where specified.
- [ ] Mobile (375):
  - touch targets ≥ 44×44px for every tappable control (buttons, nav items, menu/close buttons, links in lists);
  - no horizontal scroll at 375 (`document.documentElement.scrollWidth <= 375`, asserted in Playwright);
  - readable type: body ≥ 15px, input text ≥ 16px (prevents iOS zoom), H1 ≤ 28px, no text under 12px;
  - labels stacked above full-width fields;
  - side padding ≥ 16px on login and every page;
  - nav reachable: the menu button is visible in the top bar on every authed page, opens the role nav sheet, focus is trapped in it, Esc and ✕ close it, and focus returns to the menu button.
- [ ] Copy is sentence case, verb-first buttons, no filler or lorem.
- [ ] No purple, no gradients, no decorative icon grids.
- [ ] Screenshots attached match the mockup within reason; deviations are explained.

## Breakpoints (single source of truth)
- Mobile < 768px: top bar, menu button, nav sheet.
- Tablet 768–1023px: 56px icon rail.
- Desktop ≥ 1024px: full 256px sidebar. The page content max width is 1200px, which is a container width, not a breakpoint.

## References (repo paths)
- Design system: `docs/design/design-system-v1.md`.
- Screen plan: `docs/design/fas-screen-plan.md` (§0–3, incl. §1.2 nav) and `docs/design/fas-screen-plan-part2.md` (§4–7).
- Specs: `docs/design/specs/<ID>.md`.
- Mockups: `docs/design/mockups/*.png` (desktop 1440 plus `-375` mobile variants); HTML sources in `docs/design/mockups/src/`.
