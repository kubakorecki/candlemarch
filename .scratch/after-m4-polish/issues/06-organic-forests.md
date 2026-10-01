# Trees at the start, and forests that grow organically

Status: resolved
Type: task
Blocked by:

## What

- The start area is a big empty field. Scatter trees there too, sparsely (owner), keeping a small clear yard round the Granary and Stockpile and the way from the entry open. The spec's "24 × 24 buildable Meadow" guarantee stays true in spirit (trees can be felled); update its wording.
- Forests look dense and like rows of trees. Make them organic: density that fades toward the edges, gaps and clearings, scattered outliers; and in the client, jitter each tree's drawn position within its tile (deterministic from the tile) so the grid doesn't read as rows.
- Keep every guarantee and the 100-seed Valley test; rerun `valley` (its layout coordinates will move: re-place them and keep the scenario test passing) and log the numbers.

## Done when

- Generator tests pass on seeds 1–100; the start area has scattered trees and a clear yard.
- Screenshots of seed 1 before and after. `pnpm check` passes.

## Comments

- 2026-10-01: Done. Woods thin from 85% trees deep inside to 35% at the edge, then to 1% lone outliers across open Meadow, with clearings from a second noise; the Camp's wood thins toward the Camp and the east (no clearings there, to keep 150 trees within 15). The clear square has trees on 6% of it, none within 5 tiles of the Granary (the yard, which meets the entry gap). The client stands each tree, Sapling and Stump up to a quarter tile off its tile's centre (a hash of the tile) and draws a run back to front. Beyond the issue: `connect` no longer plants over 1–2-tile gaps in the Forest (trees are walked through, so it only refilled the gaps). Retries over seeds 1–100: 8 → 4. `valley` placements still fit and keep their roles, so unchanged; it ends Y2 Spring 1 with 6 villagers, nobody lost, 2 meat (was 5). Numbers in `docs/decisions.md`.
