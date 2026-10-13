# AGENTS.md — FAS Evidence (Public Data to Proof)

You are working in the repo for FAS Evidence, a free tool built for **Family Advocacy Services (FAS)**, a Utah nonprofit that pays for therapy for families who can't afford it, many referred through courts. The tool collects free public data, accepts FAS's own data, shows both, matches FAS to grants and produces evidence packets. Keep this file short; details live in the linked docs.

## Read order (every session)
1. This file.
2. `harness/progress.md` — the last 3 entries.
3. Your task packet (GitHub Issue labeled `packet`) and its `context_files`.
4. Only the docs your packet names: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATA_SOURCES.md`, `docs/GRANT_MATCHING.md`, `docs/PRIVACY_AND_COMPLIANCE.md`.
5. For any UI work: `docs/DESIGN.md` (design brief: tokens, components, and design rules).

## Stack
Next.js (App Router, TypeScript) on Vercel · Supabase (Postgres, Auth, RLS, Storage, Edge Functions) · n8n (n8n.casepilot.io) for schedules and alerts · Playwright for e2e · Vitest for unit tests.
*(Pinned: Next.js 16.4.0 and React 19.3.0 in `package.json`; Supabase CLI 2.120.0 in the Cloud Agent shell.)*

## Commands
> The `pnpm` scripts below are defined in `package.json`.
```
pnpm install            # install
pnpm dev                # run app on :3000
pnpm lint               # eslint
pnpm typecheck          # tsc --noEmit
pnpm test               # unit tests (vitest)
pnpm test:db            # RLS + catalog guard vs local Supabase (loads API_URL/ANON_KEY/SERVICE_ROLE_KEY/DB_URL from `supabase status -o env`; needs `psql`)
pnpm test:e2e           # playwright
pnpm seed:synthetic     # load synthetic FAS data into local DB
supabase start          # local Supabase (needs Docker)
supabase db reset       # rebuild local DB from migrations + seed
```
**Smoke check before you start and before you finish:** `pnpm install && pnpm lint && pnpm typecheck && pnpm test`.

## Repo layout
```
app/(app)/           signed-in routes: admin/, board/, dashboard/, need-map/, staff/
app/api/             route handlers: auth/, health/, ingest/
app/login/, app/403/ sign-in and error pages
components/          UI (shadcn/ui based)
lib/                 app logic: auth/, dashboard/, db/, ingest/, need-map/, shell/, status/, supabase/, synthetic/
packages/ingest/     one module per public data source (pure, testable): sahie/, saipe/, acs5/
supabase/migrations/ schema changes (never edit an applied migration)
n8n/                 exported n8n workflow JSON (schedules + alerts)
scripts/             nightly audit, staleness check, test:db runner
tests/               db/, e2e/, fixtures/, golden/
docs/                specs (read-only for engineers unless your packet says otherwise)
harness/             plan, feature list, progress, decisions, audits
```
Not in the repo yet: `lib/metrics/` (metrics and suppression helpers, F-304/F-306), `lib/grants/` (Phase 5), `supabase/functions/`.

## Golden rules
1. **One feature per session**, matching your packet's `feature_id`. Small diffs.
2. **Synthetic data only.** Never use, request or paste real FAS client data. Never connect to production.
3. **No secrets in code or commits.** Use environment variables; Cursor Cloud secrets live in Cursor's Secrets tab.
4. **Every displayed number comes from the database** and traces to a source row with a date (`source_id`, `vintage`, `ingest_run_id`) or to an FAS upload batch.
5. **Privacy is enforced in code:** county-level geography in shared views, suppress counts < 11 (with complementary suppression), month/quarter dates in exports, no court documents, no substance-use fields, no clinical notes. See `docs/PRIVACY_AND_COMPLIANCE.md`.
6. **Migrations are forward-only.** New file per change; RLS enabled and deny-by-default on every new table.
7. **AI-generated text in the app** (strategy drafts) must cite stored rows and be labeled DRAFT. No invented statistics.
8. **Don't edit** `harness/feature_list.json` statuses (QA only) or acceptance criteria (George only).

## Definition of done
Tests for every acceptance criterion · smoke check green · app starts · no secrets or real data in the diff · hand-written diff ≤ 400 lines (`max_diff_lines`; lockfiles and generated files don't count but are listed by name in the PR body, D-012) · `harness/progress.md` entry appended · PR opened with the template · QA packet requested.

## Merge and release
- George does not review or merge PRs. The Engineer Supervisor squash-merges and deletes the branch once QA posts PASS on every acceptance criterion, with evidence, at the PR's current head sha; if the head moves, QA re-checks first (D-013).
- After QA PASS at head and a working preview, the team may deploy to production, apply production DB migrations, and create, edit and activate n8n workflows on n8n.casepilot.io without asking George. Engineer sessions still work in local/preview only (golden rule 2) (D-014).
- Still gated on George (`human_gate: george`): real FAS data, outbound email, acceptance-criteria changes. Money or plan decisions go to George through Chief of staff (D-014).

## Ending a session cleanly
Commit working code only. If you must stop mid-feature, leave the code compiling, write exactly what's left in `progress.md`, and say so in your return report.

## Cursor Cloud specific instructions
- The machine is defined by `.cursor/environment.json`. `install` runs `.cursor/install.sh` (Docker, Supabase CLI 2.120.0, `pnpm install --frozen-lockfile`). `start` runs `.cursor/start.sh` (dockerd, `supabase start`, `pnpm dev`).
- Node comes from the image via nvm (`v22.22.2`); `install` symlinks `node` and `pnpm` (10.33.3) into `/usr/local/bin` so login shells find them.
- Docker: Ubuntu `docker.io` 29. The default overlay snapshotter fails in this VM (`mount ... overlay ... invalid argument`). `.cursor/start.sh` uses `fuse-overlayfs`, turns off the containerd snapshotter, and switches iptables to legacy. systemd is not usable here (`policy-rc.d` denies service starts), so the script launches `dockerd` in tmux session `dockerd`.
- Ports: Next.js `3000`. Supabase API `54321`, Postgres `54322`, Studio `54323`, Mailpit `54324`. First `supabase start` pulls images and can take several minutes; later boots reuse the images.
- App check: `curl -fsS http://127.0.0.1:3000/api/health` reports the app and whether the local Supabase API answers.
- Secrets come from Cursor's Secrets tab as environment variables. If one is missing, stop and report; don't hardcode. No secrets are required to boot this shell.
- Cloud agents may reach preview/dev services only. Never production.
- Long-running dev server: `start` already runs it in tmux session `web` (`/tmp/web.log`). Do not start a second `pnpm dev`.

## Supabase projects
- `fas-dev` (ref `zlizvzpatfyhdydfmxef`) is the only FAS Supabase project. It holds synthetic data only and is used by Vercel previews.
- The other project in the account, `dhlvtisumrvhnqbeidlt`, is NOT FAS and NOT production. Do not use it.
- There is no FAS production database yet.

## GitHub Copilot cloud agent
- Copilot reads this file and `.github/copilot-instructions.md`.
- Its environment is `.github/workflows/copilot-setup-steps.yml` (an Actions runner, not the Cursor machine).
- There is no local Supabase there by default; run the smoke check and leave `test:db`/`test:e2e` to CI.
- Only issues marked `Route: Copilot` go to Copilot; see `harness/COPILOT_ROUTING.md`.
- Copilot never touches workflows, rulesets, auth/middleware, migrations/RLS, n8n or real data.
- Copilot never makes money, plan or billing changes, sends email in George's name, or edits acceptance criteria.
- Needs-George items stop and go to George through the Engineer Supervisor and Chief of staff.
- Same gates as Cursor: D-012 cap, QA PASS and DESIGN APPROVED at the same head, CI and secret scan green.
