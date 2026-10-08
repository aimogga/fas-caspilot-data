## Packet
- Packet: TP-____  · Feature: F-____
- Risk: low / medium / high · Human gate: none / george-before-merge / george-before-deploy

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
- [ ] `harness/progress.md` entry appended
- [ ] QA packet requested

## What I did not do
