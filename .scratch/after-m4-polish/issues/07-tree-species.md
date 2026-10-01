# Tree species and variety

Status: resolved
Type: task
Blocked by: 06

## What

Forests look repetitive (owner). Add variety within a species (size, shape, lean, shade from a deterministic per-tile hash) and different kinds of forest with their own species (e.g. pinewood, oakwood, birch), chosen per region.

Default: visual only. Trees stay one map object (`tree`, logs, shade, Game); the species comes from the tile in the client (region noise + hash), so the sim and saves don't change. Log it in `docs/decisions.md` so a gameplay meaning can come later.

## Done when

- Screenshots show at least three forest kinds and visible variety inside each. Art follows the placeholder rules (bold outlines, desaturated fills, palette module).
- `pnpm check` passes.

## Comments
- 2026-10-01 — Done, visual only as the default says: three kinds of wood, oakwood (round crowns), pinewood (tiered, reddish bark) and birchwood (pale streaked trunks, airy light crowns), each a patch round a hashed "wood heart" every 14 tiles (`client/src/render/treeLooks.ts`); inside a wood every tree has its own size, lean, crown shade (three a species) and crown shape (four a species) from a hash of its tile. Saplings and Stumps take their tile's species (a birch Stump is pale and streaked). The Fell pennant flies above whichever crown. The sim and saves are unchanged; logged in `docs/decisions.md`.
