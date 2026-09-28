# Nights scenario

Status: resolved
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

## Comments

- 2026-09-28: Done. New map `nights` (in `maps`, so the playtest can start on it) with a Den past a gap in a wood; scenarios `nights` (palisade + Gate across the gap, a watchtower covering the Gate, a brazier in the yard, all placed at Dawn of day 1) and `nightsUnprepared` (no commands), five spring nights each, tested in `tooling/balance/nights*.scenario.test.ts`. The balance table gains a column per death cause. Prepared: no deaths, the tower kills the Gloamling at the Gate each night. Unprepared: all 6 villagers and a Newcomer dead by Dawn of day 4. The map has no Hero, on purpose. Numbers and tick limits in `docs/decisions.md`.
