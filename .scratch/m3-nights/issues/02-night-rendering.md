# Night rendering and light glow

Status: resolved
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

## Comments

2026-09-28 — Design session 01: House windows give no Light (Gloamlings walk right up to them). A window glow must read clearly differently from the pool of Light around a torch or brazier, e.g. a small warm window with no lit ground around it, so players don't think their Houses are safe.

2026-09-28 — Done. The sim derives `lightSources(state, content)` (`sim/src/lights.ts`): at night, a House's windows glow while a resident is at Home and the House isn't cold (a winter House that burned no fuel stays dark). The client replaces M2's tint with a multiplied darkness (`nightLook`: warm evening before Dusk, deep blue at full dark, lifting before Dawn) and draws glows on an additive layer above it. Houses always show a window; lit, it's a bright pane with a small halo and no lit ground, per the design comment. The glow (`drawGlow`) is reusable; the lit-ground pool for torches and braziers is left to ticket 06, which has the radius.
