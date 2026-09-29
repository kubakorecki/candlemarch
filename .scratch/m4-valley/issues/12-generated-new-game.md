# New game on a generated valley

Status: ready-for-agent
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
