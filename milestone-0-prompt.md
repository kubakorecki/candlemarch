We're starting a new game project called Candlemarch. Read `CLAUDE.md` and `docs/spec.md` first. The spec is the design source of truth; `CLAUDE.md` holds the engineering rules.

Your goal in this session is **milestone 0**: one resource gathered, carried and turned into a building. It's done when I can watch logs flow from the forest into a finished hut, and a headless test proves the same thing.

Start in plan mode. Show me your plan (package structure, state shape, systems and tick order, worker protocol) before writing code. Then work through the steps below in order, run `pnpm check` after each one, and commit after each step. **Stop for my review after step 1 and after step 4.**

## Step 1 — Scaffold the monorepo

- pnpm workspaces with `packages/content`, `packages/sim`, `packages/client`.
- Strict TypeScript with shared base config, Biome, Vitest.
- Root scripts: `dev`, `test`, `typecheck`, `lint`, `check`, as listed in `CLAUDE.md`.
- Enforce the import boundaries in `CLAUDE.md` (at minimum through package dependencies; add a lint rule or test if cheap).
- Create `docs/decisions.md` with a heading and your first entries.
- A placeholder test in each package so `pnpm check` passes.

## Step 2 — Content

In `packages/content`, typed data for milestone 0 only:

- Resource: `logs`.
- Terrain: `grass`, plus trees as map objects holding a number of logs each.
- Buildings:
  - `woodcutters_hut`: pre-placed at map start; employs one woodcutter; small output buffer for logs.
  - `hut`: player-placed; construction cost in logs (start with 10) plus build time in ticks.
- A content validation test (every reference points at an existing ID).

Keep all numbers in content, not in sim code.

## Step 3 — Simulation core

In `packages/sim`:

- Game state type, `createInitialState(seed, map, content)`, and `step(state, commands, content)`.
- Seeded PRNG (e.g. mulberry32) with its state stored in game state.
- A small hand-made test map, about 24×24 tiles, with a cluster of trees and the woodcutter's hut placed nearby.
- Grid pathfinding (A* over tiles, 8 directions is fine). No roads yet; that's the next milestone.
- Villagers pass through each other; no collision.
- Commands: `placeBuilding` (creates a construction site), `cancelConstruction`.
- `serialize(state)` / `deserialize(json)` for saves.

## Step 4 — Simulation systems and tests

Systems, run in a fixed order each tick:

1. **Woodcutting:** the woodcutter walks to the nearest tree with logs left, chops for a set number of ticks, carries 1 log back to the woodcutter's hut output buffer, repeats. A tree with no logs left is removed.
2. **Hauling:** one carrier villager takes logs from the hut's output buffer to construction sites that still need logs. Put hauling behind a small interface (e.g. a `LogisticsModel` with a job-dispatch implementation), because we will later prototype a second model (Settlers-style flag relay).
3. **Construction:** a site becomes a finished `hut` once all logs are delivered and build time has passed.

Tests, all headless:

- Placing a hut leads to a finished hut within N ticks (choose N with some margin and document it).
- Determinism: the same seed and commands run twice give deep-equal state.
- Save/load: serialize at tick T, deserialize, continue; result equals an uninterrupted run.
- The woodcutter stops cleanly when all trees are gone.

## Step 5 — Client

In `packages/client`:

- Vite + React + PixiJS v8.
- The sim runs in a Web Worker. The main thread sends commands and receives state, and renders with interpolation between ticks.
- Isometric rendering of the map: tiles, trees, buildings, construction sites (showing logs delivered / needed), villagers, and the log a villager is carrying.
- Placeholder art drawn in code: bold dark outlines, flat desaturated earthy fills, palette in one module. Not pixel art.
- Camera: drag to pan, mouse wheel to zoom.
- A minimal React HUD:
  - build button for `hut`, then click a tile to place it (with a valid/invalid placement preview);
  - pause, 1×, 2×, 3× speed;
  - save and load (browser storage is fine for now);
  - a small readout of logs in the woodcutter's hut buffer.
- Autosave at the start of each in-game day is **not** needed yet; there's no day cycle in milestone 0.

## Done when

- `pnpm check` passes.
- `pnpm dev` opens a map where I can place a hut and watch the woodcutter chop, the carrier haul, and the hut complete.
- Pause, speed and save/load work.
- `docs/decisions.md` lists the choices you made where the spec was open.

If anything in the spec or these steps conflicts with `CLAUDE.md`, follow `CLAUDE.md` and tell me.
