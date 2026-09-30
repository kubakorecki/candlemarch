# Trees at the start, and forests that grow organically

Status: ready-for-agent
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
