# Tree species and variety

Status: ready-for-agent
Type: task
Blocked by: 06

## What

Forests look repetitive (owner). Add variety within a species (size, shape, lean, shade from a deterministic per-tile hash) and different kinds of forest with their own species (e.g. pinewood, oakwood, birch), chosen per region.

Default: visual only. Trees stay one map object (`tree`, logs, shade, Game); the species comes from the tile in the client (region noise + hash), so the sim and saves don't change. Log it in `docs/decisions.md` so a gameplay meaning can come later.

## Done when

- Screenshots show at least three forest kinds and visible variety inside each. Art follows the placeholder rules (bold outlines, desaturated fills, palette module).
- `pnpm check` passes.

## Comments
