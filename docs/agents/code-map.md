# Code map

Orientation for agents. Read before exploring; update when a module is added, moved or renamed.

## content (`packages/content/src`): typed data, no logic
- `types.ts`: every ID union (`ResourceId`, `BuildingId`, `JobId`, `RecipeId`, `TerrainId`, `MapObjectId`, `RoadId`, `HeroId`, `SeasonId`) and def shape (`BuildingDef`, `RecipeDef`, `JobDef`, `CalendarDef`, `NeedsDef`...), plus the `Content` aggregate.
- `index.ts`: assembles and exports `content: Content`; re-exports all types.
- `resources.ts` (`storage`: stockpile | granary), `recipes.ts`, `buildings.ts` (size, door, employs, buffers, recipes, `residents` (makes it a House), `foodCapacity` (makes it a Granary), construction cost), `jobs.ts` (walk speed, carry, idle retry), `mapObjects.ts` (tree), `terrain.ts`, `roads.ts`, `heroes.ts` (aura), `logistics.ts` (stockpile tile capacity), `calendar.ts` (dayTicks 3600, seasons, night length, riverFrozen), `needs.ts` (Tired: min sleep %, speed %; Hungry: meal units, speed %, starve after; Cold goes here too), `villagerNames.ts`.

## sim (`packages/sim/src`): pure, deterministic
- `index.ts`: public API; the client and tooling import only from here. Export new helpers here.
- `state.ts`: `GameState`, `Components`, all component and task types, `STATE_VERSION`, `TICKS_PER_SECOND`, `TILE_UNITS` (1000), `DIAGONAL_UNITS`.
- `step.ts`: `step()`, the tick (see below). `commands.ts`: `Command` union + `applyCommand()` switch.
- `entities.ts`: `createEntity`, `destroyEntity` (clears every store), `idsOf` (sorted IDs; use for any ordered loop).
- `rng.ts`: mulberry32 over `state.rng`: `seedRng`, `nextU32`, `randomInt(state, n)`.
- `calendar.ts`: derived from `state.tick`, nothing stored: `calendarAt`, `isNight`, `isDawn`, `isDusk`, `dawnTick`, `duskTick`, `isRiverFrozen`.
- `map.ts`: `MapDef`, `MAP_LEGEND` (`.` grass, `T` tree, `=` path, `~` river), `createEmptyState`, `createInitialState(seed, map, content)`.
- `maps/`: `meadow` (default, milestone 0), `shortHaul`, `longHaul`, `branchingNetwork`; `index.ts` has `maps`, `MapName`, `DEFAULT_MAP`.
- `grid.ts`: tile maths (`tileIndex`, `tileAt`, `tileCenter`, `tileOfPoint`, `rectTiles`), `footprint`, `doorTile`, `entityDoor`, `blockedGrid`, `standingTiles`, `isRiverbank`, `fitsAt`, `canPlaceBuilding`.
- `pathfinding.ts`: A* `findPath`, `travelCosts` (Dijkstra), `tileDistance`; road-aware costs.
- `roads.ts`: `lShapeTiles`, `canLayPath`, `layPath`, `removePath`, road speed grids.
- `stockpiles.ts`: place/remove, `isStockpileGood`, `stockpileTakes`, per-tile `amountOnTile`/`roomOnTile`/`takeFromTile`/`addToTile`.
- `villagers.ts`: `drawVillagerName`, `assignJob` (sets job + workplace, resets task store for the job).
- `workers.ts`: `maxWorkers`, `workersAt`, `vacantPositions`, `reassignTargets`, `unassignWorker`, `reassignWorker`, `setWorkerLimit`.
- `hero.ts`: `HeroOrder`, `heroOf`, `orderHero`, `heroOrderAt` (what a right-click means), `heroSystem`.
- `aura.ts`: hero production aura: `workSpeedPercent`, `boostedWorkplaces`.
- `speed.ts`: the shared slowdown helper. `speedPercent(state, content, villager, workplace?)` = worst slowdown (Tired, Hungry; add Cold here) × aura at `workplace`; `workTicks(state, content, worker, workplace, ticks)` (apply to any work timer). Movement scales walking by `speedPercent` without a workplace.
- `granary.ts`: Granaries (Food in `building.stock`): `isFood`, `foodIds`, `isGranary`, `foodIn`, `granaryRoom`, `villageFood`, `eatingOrder`, `hasMeal`, `takeMeal`, `nearestGranaryWithMeal`.
- `homes.ts`: `homesSystem` (clears Homes that are gone, gives Homeless villagers a free place), `housePlaces`, `residentsOf`.
- `save.ts`: `serialize`, `deserialize` → `normalizeLoadedState` (backfills fields added since the save).
- `logistics/jobDispatch.ts`: carriers: `Haul`, `LogisticsState`, `updateHauls`, `abandonHaul`, `isCarrierIdle`, reservations. ADR 0001.
- `logistics/supplyDemand.ts`: `listSupplies`, `listDemands` (sites, workshop inputs, Granaries, stockpiles), `inputRoom`.
- `systems/movement.ts`: `movementSystem`, `walkTo`, `rerouteTo`, `stopAtNextTile`, `isAt`, `villagerTile`, `walkGrid`.
- `systems/woodcutting.ts`, `fishing.ts`, `production.ts` (workshops; `isPaused`, `villageStock`), `hauling.ts` (calls `updateHauls`), `construction.ts`, `staffing.ts` (`openPositions`). Work systems and dispatch skip villagers whose `routine` isn't `work`.
- `systems/routine.ts`: `routineSystem`, the Dusk/Dawn routine on `villager.routine` (`work` → `toGranary` → `goingHome` → `asleep`): `finishWork` (what's dropped or finished at Dusk), `seekMeal` (nearest Granary with a Meal, eat, or go home Hungry), `goHome`, sleep counting, Tired set at Dawn and cleared at Dusk, a Meal missed at Dawn.

## client (`packages/client/src`)
- `main.tsx`: React root, `applyPaletteToCss`. `ui/App.tsx`: creates `Game`, mounts `Hud` and (dev only) `NewGamePanel`.
- `protocol.ts`: `ToWorker` (`newGame`, `load`, `advance {ticks, commands}`, `save`) / `FromWorker` (`snapshot {state, prevPositions}`, `saved`, `error`).
- `worker/sim.worker.ts`: holds `GameState`, runs `step()` N times per `advance` (commands on the first), posts the full state as a snapshot.
- `game/SimBridge.ts`: main-thread side: owns the clock, queues commands (`command()`), sends `advance` once per frame (max 10 ticks, one request in flight), exposes `state`, `prevPositions`, `alpha`.
- `game/clock.ts`: `tickClock`, `tickFraction`, `SPEEDS` (0–3).
- `game/Game.ts`: glue: `TOOLS` (toolbar, shortcuts), input → `bridge.command(...)`, `HudState` store (`subscribe`/`getHud`), selection panels (`VillagerInfo`, `BuildingInfo`, `WorkersView`), save/load via localStorage.
- `render/WorldRenderer.ts`: Pixi scene. `syncStatics` (per snapshot: ground, roads, trees, buildings, sites, stockpiles), `drawWalkers` (per frame, interpolated villagers + hero), `drawNight`, ghosts, hit tests. `JOB_COLORS`.
- `render/shapes.ts`: all placeholder drawing: `drawBuilding` (generic), `drawChoppingBlock`, `drawSite`, `drawVillager`, `drawVillagerStatus` (Homeless, Tired "zzz", Hungry bowl icons over the head; add Cold here), `drawHero`, `PIECES` (per-resource goods art), roads, ghosts.
- `render/iso.ts`: all iso maths (`TILE_W` 128, `gridToWorld`, `screenToTile`, `unitsToGrid`, `depthOf`...). `render/palette.ts`: `palette`, only colour source (HUD via CSS vars). `render/camera.ts`: pan/zoom input. `render/night.ts`: `nightDarkness`.
- `ui/Hud.tsx`: all HUD panels (readout, toolbar, speed, stockpile, villager, building, workers). `ui/hud.css`. `ui/NewGamePanel.tsx`: map picker.

## tooling
- `boundaries.test.ts`: import-boundary test (manifests, sim imports, hidden inputs grep).
- `balance/harness.ts` (`Scenario`, `runScenario`, `formatTable`), `balance/scenarios.ts` (named scenarios), `balance/cli.ts` (`pnpm balance <name>`), `balance/harness.test.ts`.

## The tick: `sim/src/step.ts` `step(state, commands, content)`
Clones state (JSON), then: 1 `applyCommand` per command (`commands.ts`) → 2 `movementSystem` → 3 `homesSystem` (`homes.ts`) → 4 `routineSystem` → 5 `heroSystem` (`hero.ts`) → 6 `woodcuttingSystem` → 7 `fishingSystem` → 8 `productionSystem` → 9 `haulingSystem` → 10 `constructionSystem` (skips at night) → 11 `staffingSystem` → `tick += 1`. Systems mutate the clone.

## State (`sim/src/state.ts`)
- `GameState`: `version`, `tick`, `rng` (PRNG uint32), `nextId`, `map` (`width`, `height`, `terrain[]` row-major, `roads` by tile index), `components`, `logistics.hauls` (by carrier ID).
- `components`: `Record<EntityId, T>` stores: `tile`, `mapObject`, `building`, `site`, `stockpile`, `villager`, `hero`, `position`, `path`, and task stores `woodcutter`, `crafter`, `fisher`.
- `villager`: `name`, `job`, `workplace`, `carrying`, `home` (House ID or null = Homeless), `routine` (`work` | `toGranary` | `goingHome` | `asleep`), `sleptTicks` (at Home, this night), `tired`, `missedMeals` (Hungry when > 0).
- `building.stock`: output buffer, or a Granary's Food; `building.input`: workshop input buffer.
- IDs: `createEntity(state)` takes `state.nextId++`. A site becomes a building with the same ID.
- Time: `calendarAt(state.tick, content)` → `{day, season, dayOfSeason, year, timeOfDay, isNight}`.

## How to add…
- **Resource**: `ResourceId` in `content/src/types.ts`; entry in `resources.ts`; `PIECES` in `client/src/render/shapes.ts` (type error until you do). Goods on stockpiles unless `storage: 'granary'`.
- **Building**: `BuildingId` + def in `content/src/buildings.ts` (new fields go in `BuildingDef`, `types.ts`; check `content/test/validate.test.ts`). Placement is generic (`grid.ts` `canPlaceBuilding`); special rules go there. Rendering: generic `drawBuilding` unless special-cased in `WorldRenderer.syncStatics` (like `chopping_block`). Toolbar: `TOOLS` in `client/src/game/Game.ts`.
- **Command**: add to `Command` union + case in `applyCommand` (`sim/src/commands.ts`), logic in its module; test in `sim/test/commands.test.ts` or the feature's test; client sends it with `this.bridge.command({...})` from a `Game` method, wired to a button in `ui/Hud.tsx`.
- **System**: `sim/src/systems/<name>.ts` exporting `<name>System(state, content)`; call it in `step.ts` and update the order comment; loop with `idsOf`; use `workTicks` (aura) for work timers.
- **Villager task/activity**: task union in `state.ts`, store in `Components` and `createEmptyState` (`map.ts`); init/clear in `assignJob` (`villagers.ts`); undo work in progress in `release` (`workers.ts`); new Job: `JobId` + `jobs.ts` + `JOB_COLORS` (`WorldRenderer.ts`) + palette colour; animation in `drawVillagers`. Missing stores in old saves backfill automatically; new fields in existing components need a line in `save.ts` `normalizeLoadedState` (breaking change: bump `STATE_VERSION`).

## Tests
- `pnpm vitest run packages/sim/test/hauling.test.ts` runs one file. `pnpm test` runs all projects (`vitest.config.ts`).
- `sim/test/helpers.ts`: `run(state, ticks, commandsAt)`, `runUntil(state, done, max, commandsAt)`, `totalLogs`, `woodcuttersHutStock`, re-exported `content`.
- Small maps: inline `MapDef` constants in each test file (e.g. `yard` in `construction.test.ts`, `riverMap()` in `river.test.ts`), built with `createInitialState(seed, map, content)`.
- Determinism: `sim/test/milestone.test.ts` ("is deterministic"). Save/load continuation: `sim/test/scenarios.test.ts` (branching network), `hero.test.ts` (mid-walk) and `sleep.test.ts` (mid-night); format/backfill in `save.test.ts`.
- Meals and Hungry: `sim/test/granary.test.ts` (a river camp with a fisher's hut, Granary and Hut; a test `Content` treats logs as a second Food).
- Night tests (`sleep.test.ts`) start a state at Dusk with a `jump(s, tick)` helper that just sets `tick`. A state at tick T hasn't run tick T yet: to see Dawn's effects, run to `DAWN + 1`. Jumping straight to a Dawn makes everyone Tired (no sleep counted).
- Content validation: `content/test/validate.test.ts`. Import boundaries + hidden inputs: `tooling/boundaries.test.ts`.
- Client unit tests: `client/test/{clock,iso,night}.test.ts`. Balance: `pnpm balance meadow` (add scenarios in `tooling/balance/scenarios.ts`).

## Docs
- Decisions: one line in `docs/decisions.md` (date, decision, why). ADRs: `docs/adr/`. Glossary: `CONTEXT.md` (use its terms: Workplace, Carrier, Hut...).
- Issues: `.scratch/<feature>/issues/NN-*.md`; closing rules (`Status: resolved`, dated comment, spec status) in `docs/agents/issue-tracker.md`.
