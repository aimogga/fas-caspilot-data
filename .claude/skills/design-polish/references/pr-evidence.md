# PR evidence

## Shots
Taken with `pnpm shots -- --id DS-<id> --tag before|after --role <role> --route <route> [--base <url>] [--hover "<selector>"] [--focus "<selector>"] [--print] [--dark]`.

Files: `docs/design/reviews/DS-<id>/<before|after>/<route-slug>-<width>[-hover|-focus|-print|-dark].png`, plus `manifest.json` in the packet folder. Widths 375, 1024, 1440. Full page only at 375. At most 12 PNGs per PR; delete extras before committing. Never commit a PDF unless the packet is a print packet.

The password comes from `DESIGN_SHOTS_PASSWORD` in the environment (the cloud environment "vercel.app" holds it; the local seed password is used only against 127.0.0.1). Never print it, never put it in a file.

## PR body table (paste under "What changed")
```
| Width | Before | After |
|---|---|---|
| 375 | ![](docs/design/reviews/DS-<id>/before/<slug>-375.png) | ![](docs/design/reviews/DS-<id>/after/<slug>-375.png) |
| 1024 | ![](…/before/<slug>-1024.png) | ![](…/after/<slug>-1024.png) |
| 1440 | ![](…/before/<slug>-1440.png) | ![](…/after/<slug>-1440.png) |
| 1024 hover | — | ![](…/after/<slug>-1024-hover.png) |
```
Use the branch-relative paths above; GitHub renders them once the images are on the branch.

Also include: the axe line from the route's e2e spec, the `pnpm gate` D-012 line, excluded files by name, and one sentence comparing the result with the mockup (what matches, what was deliberately left for a later packet).

## Fallback when the preview path is unavailable
If the vercel.app environment cannot install Playwright or lacks the password, the route's e2e spec writes the same shots to `/opt/cursor/artifacts/DS-<id>/` in CI; link the CI run in the PR body under "Evidence" and write "shots: CI artifact". The supervisor downloads and commits them before merge.

## Living review page
`pnpm review-page` rebuilds `docs/design/reviews/index.html` from every manifest. The supervisor publishes it as a private artifact after each merge; packets do not need to touch it.
