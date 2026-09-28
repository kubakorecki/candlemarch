# Nights scenario

Status: ready-for-agent
Type: task
Blocked by: 06, 07, 08, 09, 10, 13

## What

- A hand-made map with a Den near the Camp.
- Headless tests: a prepared layout (Light, palisade with a Gate, a staffed watchtower) survives 5 nights with fair losses; an unprepared one loses villagers.
- The same scenario in the balance harness, with deaths by cause in the table.
- The existing `camp` and `campNoFirewood` scenarios stay unchanged (no Dens).

## Done when

- Tests pass; tick limits logged in `docs/decisions.md`.
- `pnpm check` passes.
