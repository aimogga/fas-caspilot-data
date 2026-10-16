## Packet
- Packet: TP-____  · Feature: F-____
- Risk: low / medium / high · Human gate: none / george (D-013, D-014)

## What changed (3 lines max)

## Acceptance criteria → tests
| Criterion | Test file / case |
|---|---|
|  |  |

## Checklist
- [ ] Smoke check green (`pnpm lint && pnpm typecheck && pnpm test`)
- [ ] Synthetic or public data only; no secrets
- [ ] New tables have RLS (deny by default) + policy tests
- [ ] Displayed numbers trace to stored rows (source_id / vintage / upload batch)
- [ ] Suppression applied to any shared output
- [ ] One new `harness/progress/<YYYY-MM-DDTHHMMZ>-<branch>.md` entry added (D-041)
- [ ] Hand-written diff ≤ 400 lines (`max_diff_lines`); lockfiles and generated files don't count but are listed below (D-012)
- [ ] QA packet requested

## Lockfiles and generated files (excluded from diff cap)
- none

## What I did not do
