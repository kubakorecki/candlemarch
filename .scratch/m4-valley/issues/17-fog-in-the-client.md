# Fog drawn in the client

Status: resolved
Type: task
Blocked by: 14, 16

## What

Rules in `docs/spec.md`, World and map ("Fog"). Drawing only: the sim says which tiles are Revealed and In sight.

- **Unrevealed** tiles are black: nothing on them is drawn, Dens and POIs included.
- **Revealed** tiles not In sight are dimmed. Ground, trees and buildings are drawn as last seen; villagers, Gloamlings and carried goods aren't.
- **In sight** tiles are drawn live.
- The edge between the states is soft, not a hard tile grid, in the palette's dark tones. It must still read well at night next to Light.
- Placement previews show unrevealed tiles as invalid.
- The dev panel gains a Fog on/off switch (the dev command from ticket 16).
- Keep it inside the client budget of ADR-0004.

## Done when

- In the browser: a generated or hand-made map with Fog on shows all three states; walking the Hero into the dark reveals the land; a Gloamling appears only In sight; the dev switch turns Fog off and on.
- The frame budget still holds at 128² with Fog on.
- `pnpm check` passes.

## Comments

- 2026-09-30 — Done. Fog is one texture, a pixel per tile, softened on the seen side and drawn with linear filtering over the world (`render/fogField.ts`, `render/fogLayer.ts`), under the placement ghost and the night; nothing on an unrevealed tile is drawn (trees and forage patches via `MapObjectRuns.update`'s `shown`), and walkers, Gloamlings' eyes and health bars only In sight. The dev panel has "Fog on/off now" (`setFog`). Beyond the issue: `heroOrderAt` ignores a Gloamling out of sight and just walks the Hero onto an unrevealed tile, and clicks and the attack cursor ignore what's on unrevealed tiles, so the dark doesn't leak through input. Revealed tiles out of sight show the static layers as they are now, not a remembered copy (see `docs/decisions.md`). The worker's `newGame` still has no Fog field; ticket 12 adds the New-game setting. Checked in headless Chrome: a hand-made map with the Hero walking into the dark (a Den appears once Revealed, stays dimmed when left), the nights map at Dusk (Gloamlings show only near the lit Houses), the dev switch off and on, a placement preview red over the dark; at 128² with Fog on, 60 fps, rAF p95 16.8 ms (`benchmark.md`).
