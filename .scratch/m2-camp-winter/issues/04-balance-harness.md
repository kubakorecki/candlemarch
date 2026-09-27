# Balance harness

Status: resolved
Type: task
Blocked by: none

## What

Headless balance runs, as the spec asks ("does a 20-person village survive winter 3?").

- `tooling/balance/`: a script that loads a scenario (map + seed + logistics model + a scripted list of commands at given ticks), runs `step` for N ticks, and prints metrics per in-game day: population, stock per resource, deaths so far.
- `pnpm balance <scenario>`; add it to CLAUDE.md Commands.
- One scenario to start: the meadow map for 1 in-game day.
- Imports `sim` and `content` only.

## Done when

- `pnpm balance meadow` prints a table; a small test runs the harness on a tiny scenario.
- `pnpm check` passes.

## Comments

2026-09-27 — Done in `a47cb2e` (tooling: add the balance harness).
