# Fog drawn in the client

Status: ready-for-agent
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
