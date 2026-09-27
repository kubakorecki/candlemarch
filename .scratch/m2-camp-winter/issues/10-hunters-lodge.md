# Hunter's lodge and hunting grounds

Status: ready-for-agent
Type: task
Blocked by: 07, m1-roads-logistics/06

## What

Spec: World and map, "Before full ecology (M2)".

- Maps define **Hunting grounds**: regions (rectangles for now) with a name and a max Game count. State per ground: current `game`, and the number of trees in it at the start (so the ceiling can be derived).
- Ceiling = `trunc(maxGame × standing trees ÷ starting trees)`. When a tree in a ground is felled and `game` is above the new ceiling, the surplus flees at once (`game = ceiling`); record the flight count on the ground for the UI ("2 fled due to logging").
- Content: resources `meat` (food), `hides` (stockpile). Building `hunters_lodge` with a hunter and a radius.
- A hunt: the hunter walks to a tile of the nearest ground overlapping its radius that has game, spends hunt ticks, and rolls with the seeded PRNG. Chance = `50% × game ÷ maxGame` (integer permille). A catch yields 4 meat + 1 hide and removes one animal; a miss returns empty-handed. No hunt when every ground in reach is empty.
- Hunting continues in winter. No recovery (M4).
- Health words for the UI, derived from game ÷ max: Thriving (≥ 75%), Thinning, Scarce (< 25%), Empty (0). Thresholds in content.
- Client: ground outline with health word and colour; a panel on selecting the ground or a lodge ("Game 12 / 20 · 2 fled due to logging · catch chance 30%"); a "fled" puff; a "no catch" icon on a returning hunter; a warning in the woodcutter's hut placement preview when its radius overlaps a ground.
- Hides pile up until the trade post (M5) can sell them.

## Done when

- Headless tests: catch chance follows game; catches reduce game; felling lowers the ceiling and makes game flee; an empty ground yields nothing; results are deterministic per seed; save/load mid-hunt.
- `pnpm check` passes.
