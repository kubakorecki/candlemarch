# Stockpile tiles hold 10

Status: resolved
Type: task
Blocked by:

## What

`logistics.stockpileTileCapacity` 8 → 10 (owner). Update the spec's number, tests that pin 8, and rerun the balance scenarios (note changes in `docs/decisions.md`).

## Done when

- A Stockpile tile takes 10 of one good; tests read the number from content where they can.
- `pnpm check` passes.

## Comments

- 2026-09-30 — Done: capacity 10 in content, the spec's Storage list now gives the number (it gave none before), tests read it from content (`map`, `stockpiles`, `heroCarry`). Balance scenarios all pass; `valley` ends Y2 Spring 1 with 0 meat instead of 4 (logged in `docs/decisions.md`).
