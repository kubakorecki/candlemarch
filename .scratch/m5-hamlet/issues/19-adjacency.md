# Adjacency likes and dislikes

Status: resolved
Type: task
Blocked by: 03, 06, 08, 12, 13, 18

## What

Spec: Villagers (Adjacency in M5).

- Content: per building (and for standing trees and Reserves) a like or dislike of ±10.
    - Likes (+10): a standing tree or Reserve tile, a Shrine, the brewery.
    - Dislikes (−10): smokehouse, charcoal kiln, brick kiln (smoke); bloomery, quarry (noise).
- Reach: 4 tiles (Chebyshev) from the source's footprint; it touches the residents of Houses there. Workplaces aren't affected in M5.
- Each kind counts once per House: ten trees still +10, two smokehouses still −10.
- Placement preview: placing a building shows a ± badge over every House it would touch; placing a House shows what its neighbours would add up to.

## Done when

- Headless tests: a smokehouse lowers its neighbours' happiness; trees raise it once however many; out of reach does nothing.
- `pnpm check` passes.

## Comments

2026-10-02 — Built. Content `adjacency` on buildings and points of interest, `happiness.woods` for trees and Reserves (one kind); `happiness.ts` adds them to each resident's sources (`woods`, `poi`, `building`), measured body to body, built buildings only. `adjacencyPreview` drives the placement badges (the change over each House touched, 0 when that kind already reaches it; a House's own total over itself) and a note naming a House's neighbours. The villager panel lists them as "Near the Smokehouse −10". Details in `docs/decisions.md`.
