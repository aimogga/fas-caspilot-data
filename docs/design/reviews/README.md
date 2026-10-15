# Design review shots

Evidence for design packets (`DS-xx`): screenshots of a route **before** and **after** a change, taken the same way every time so the design reviewer compares like with like. Everything here comes from the synthetic seed accounts; no real FAS data is ever on screen.

## What lives here

- `<id>/before/*.png` and `<id>/after/*.png` — the shots for one packet id (for example `DS-10a`).
- `<id>/manifest.json` — one row per shot, appended on every run: `{ id, tag, route, width, variant, host, sha, at }`.
- `index.html` — **generated**; run `pnpm review-page`. Never edit it by hand (it is listed in `harness/generated-files.json`, so it does not count toward the D-012 cap).
- `README.md` — this file.

## Naming

`<id>/<tag>/<route-slug>-<width>[-<variant>].png`

- route slug: the leading slash is dropped, `/`, `?` and `=` become `-`, and the root is `home` (`/need-map?county=49035` becomes `need-map-county-49035`).
- width: `375` is a full-page shot; `1024` and `1440` are the viewport only; `816` is the print shot (Letter width, full page).
- variant: none for the base shot, then `hover`, `focus`, `print` or `dark`. `--pdf` together with `--print` also writes `<route-slug>-816-print.pdf` beside the PNG.

## Commands

```
pnpm shots --id DS-10a --tag before --role staff --route /staff
pnpm shots --id DS-10a --tag after --role staff --route /staff --hover "[data-slot=home-tile]" --focus "#main a" --print --dark
pnpm review-page
```

Options: `--base` (default `http://127.0.0.1:3000`), `--widths 375,1024,1440`, `--hover <css selector>`, `--focus <css selector>`, `--print`, `--pdf`, `--dark`. Roles: `staff`, `admin`, `board` (signed in as `<role>@example.test` through `POST /api/auth/login`).

The app must already be running and seeded (`supabase start`, `pnpm seed:synthetic`, `pnpm dev`); the script signs in, it does not start the app. Playwright's Chromium is installed once with `pnpm exec playwright install chromium`.

## Rules

- At most **12 PNGs per PR**. Take the three base widths first and add variants only where the packet asks for them.
- The sign-in password comes from `DESIGN_SHOTS_PASSWORD` in your shell and is **never committed**. Against `127.0.0.1` or `localhost` only, the script falls back to the synthetic seed password; any other host without the variable stops with an error. The script prints file paths only, never the password.
- `index.html` is generated: run `pnpm review-page` after taking shots and commit it together with the PNGs and the manifest.
