# Night rendering and light glow

Status: ready-for-agent
Type: task
Blocked by: m2-camp-winter/02

## What

The look the spec describes: warm light sources pop against the dark.

- A darkness layer that deepens through dusk and lifts at dawn (replaces M2's simple tint).
- A reusable "light glow" drawn around any entity the sim marks as a light source (houses' windows at night to start), so torches and braziers get it for free later.
- Colours from `palette.ts`.

## Done when

- Visible in the browser at night; no game logic in the client.
- `pnpm check` passes.
