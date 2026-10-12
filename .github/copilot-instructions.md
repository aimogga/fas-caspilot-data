# Copilot instructions for fas-caspilot-data

Read `AGENTS.md` first.
It is the source of truth for the stack, commands and golden rules.
This file lists the repo rules a Copilot agent would not otherwise see.

## Scope and size
- Work only on the issue you were assigned.
- Touch only the files the issue lists under "Files allowed".
- Hand-written diff is at most 400 lines, added plus deleted (D-012 in `harness/DECISIONS.md`).
- Lockfiles and untouched generator output don't count, but list them by name in the PR body.
- Never pack code to fit the cap.
- Write one statement per line.
- No long chained one-liners, no multiple statements joined with `;`.
- If the work won't fit in 400 lines, stop and say so in the PR.

## Data and secrets
- Synthetic data only.
- Never use, request or paste real FAS client data.
- Never connect to production.
- Never commit secrets, tokens, keys or `.env` files.

## Do not touch
- `.github/workflows/` (CI, secret scan, nightly audit, staleness check)
- The main ruleset or any repo settings
- Auth and sessions: `middleware.ts`, `lib/supabase/`, login/session code
- `supabase/migrations/` and RLS policies
- `n8n/`
- `harness/DECISIONS.md`, statuses in `harness/feature_list.json`, acceptance criteria

If the task seems to need one of these, stop and ask in the PR.

## UI rules
See `docs/DESIGN_WORKFLOW.md` for the full design-review checklist.
- Use only existing tokens and shadcn components.
- No new colors, raw hex or oklch values, new breakpoints, or arbitrary Tailwind values (`[...]`).
- No inline styles.
- Tap targets are at least 44×44px below 1024px wide.
- Input text is at least 16px.
- Labels go above fields; errors use `role="alert"`.
- Focus ring is the 2px `--ring` token.
- Never show status by colour alone.
- No horizontal scroll at 375px (`document.documentElement.scrollWidth <= 375`).
- WCAG 2.2 AA in light and dark: text contrast ≥ 4.5:1, UI and focus rings ≥ 3:1.
- Branding is "FAS Evidence" only; no CasePilot text anywhere users see it.
- Copy must match the spec wording exactly.
- If the spec gives no wording, ask in the PR rather than invent it.
- Copy must not promise behavior the app doesn't have.
- Specs: `docs/design/specs/<ID>.md`.
- Mockups: `docs/design/mockups/`.

## Data and trust rules
- Every data number shows its source and an as-of date.
- Small counts (under 11) follow the suppression rules in `docs/PRIVACY_AND_COMPLIANCE.md`.
- New screens, layout or shell changes, and anything touching data display or trust rules stay on Cursor.
- If the issue seems to need one, stop and say so in the PR.

## Tests
- Every acceptance criterion gets a test.
- Don't weaken, skip or delete existing tests to make CI pass.
- Never delete `tests/e2e/layout-parity.spec.ts`.
- No presence-only assertions.
- Assert the behavior: text, status code, URL, focus, computed size.
- Scope e2e locators tightly.
- Next.js renders a route announcer with `role="alert"`.
- So `getByRole('alert')` alone is ambiguous; scope it to the form or region.

## Checks before you finish
Run `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test`.
`pnpm test:db` and `pnpm test:e2e` need local Supabase; CI runs them.

## Gates
- Use `.github/pull_request_template.md`.
- QA posts `PASS @ <sha>`; UI PRs also need `DESIGN APPROVED @ <sha>`, at the same head.
- Any new push voids both.
- Routing and gates: `harness/COPILOT_ROUTING.md`.
