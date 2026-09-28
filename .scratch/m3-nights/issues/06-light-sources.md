# Torches and braziers

Status: resolved
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

## Comments

- 2026-09-28: Done. Content `light` (`LightDef`) on `torch` and `brazier`; `building.lit` set by the new `lightsSystem` (7th in the tick) at every Dusk, cleared at Dawn; `light` demands after Houses, before Stockpiles; light fuel counts in `villageStock`. Gloamlings path over `gloamlingGrid` (lit tiles blocked) and drop or skip targets on lit tiles. Read "only in the seasons' nights" as every season's night, Dusk only (lights burn all year, since Gloamlings come out every night). Budding skips every tile a light could reach, fuelled or not: it runs at Dawn, after lights go out; with today's numbers the 12-tile building gap already covers it. Client: torch/brazier art, a pool of Light over exactly the lit tiles, no-firewood icon on a dark light, toolbar `l`/`z`. See `docs/decisions.md`.
