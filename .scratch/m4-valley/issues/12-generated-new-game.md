# New game on a generated valley

Status: resolved
Type: task
Blocked by: 06, 07, 17

## What

- The dev New-game panel gains "Generated valley" with a seed field. The random-seed button uses the client clock, outside the sim.
- The panel gains the Fog setting: on by default for a generated Valley, off for hand-made maps.
- The camera starts centred on the Camp.
- Hand-made maps stay available for tests and debugging.

## Done when

- Starting from any seed works in the browser; the same seed gives the same Valley.
- `pnpm check` passes.

## Comments

- 2026-09-30: Done. The dev New-game panel starts a generated Valley from a seed (Random uses the wall clock, outside the sim) or any hand-made map, with a Fog box (on for a Valley, off for a hand-made map); the worker builds the game with the sim's `newGame(setup)`, and the camera starts on the Camp's Granary (`campCentre`). Also, beyond the issue: the page now opens on Valley seed 1 with Fog on instead of the hand-made Camp, and the game-over dialog's New game restarts the last setup (logged in docs/decisions.md). Checked in headless Chrome: seeds 1, 42 and a random one start, the same seed draws the same Valley, a Shrine stays hidden under Fog until the Hero reveals it; 60 fps at 3× on a fresh Valley (numbers in benchmark.md).
