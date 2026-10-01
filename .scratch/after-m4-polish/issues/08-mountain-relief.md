# Mountains with relief

Status: resolved
Type: task
Blocked by:

## What

Mountains look flat (owner). Draw Mountain tiles with height: peaks and ridges rising from the tiles, varied per tile (deterministic), shaded by the palette, higher toward the rim. Client only; keep the culled chunk drawing within ADR-0004's client budget.

## Done when

- Screenshots of the rim before and after. Frame budget checked. `pnpm check` passes.

## Comments
- 2026-10-01 — Done, client only: a peak on every Mountain tile (`drawRelief`, a last ground layer drawn once per chunk), as high as `mountainRelief` gives from the tile's distance in from open land (foothills by the Valley, highest and snow-capped deep in the rim), varied per tile by a hash, some tiles a two-summit ridge. Deposits and the Abandoned mine are drawn over the peaks, so they stay readable, and clicking them works as before. Also: the Fog now reaches two tiles past the map's back edges, where peaks rose over it. Frame budget checked on the reference machine's GPU in headless Chromium (zoom 0.3, 3×, panning): p95 6.0 ms, unchanged from before issue 07 (6.0 ms); see `docs/decisions.md`.
