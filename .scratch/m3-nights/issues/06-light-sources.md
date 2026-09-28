# Torches and braziers

Status: ready-for-agent
Type: task
Blocked by: 01, 03, 04, m2-camp-winter/06

## What

Rules in `docs/spec.md`, "Nights in v1 (M3)" (Light) and `docs/adr/0003-light-is-a-wall.md`. Numbers Proposed, all in content.

- Buildings: torch (1×1, 1 log, radius 2, 1 firewood a night, holds 3) and brazier (1×1, 4 logs, radius 4, 2 firewood a night, holds 6). Chebyshev radius.
- **Fuel:** kept in `building.stock` like a House's. Each burns its night's firewood at Dusk; one that can't stays dark all night. Dispatch fills them after Houses and before Stockpiles. Their firewood counts toward the chopping block's target (`villageStock`).
- **Light is a wall:** Gloamlings never step onto a lit tile. Their pathfinding treats lit tiles as blocked, and a Gloamling picks a new target when its target is on a lit tile. The lit set changes only at Dusk.
- Budding (ticket 03) only picks dark tiles.
- House windows give no Light.
- Client: the glow from ticket 02 around lit light sources; a "no firewood" icon on a dark one, like a cold House.

## Done when

- Headless tests: firewood burned at Dusk only, and only in the seasons' nights; an unfuelled light stays dark; a Gloamling never enters a lit tile and retargets when its target is lit; Houses are filled before lights; budding skips lit tiles.
- `pnpm check` passes.
