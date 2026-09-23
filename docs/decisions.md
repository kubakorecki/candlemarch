# Decisions

Short log of implementation choices where the spec or `CLAUDE.md` left room. One line each: date, decision, why. Newest at the bottom.

- 2026-09-23 — Workspace packages are consumed as TypeScript source (`exports` → `src/index.ts`), with no build step between them. Why: Vite and Vitest compile TS directly, so one less thing to keep in sync.
- 2026-09-23 — Import boundaries are enforced in four layers: declared pnpm dependencies (strict `node_modules`); no DOM lib in `content`/`sim` tsconfigs; Biome `noRestrictedImports`/`noRestrictedGlobals` overrides; `tooling/boundaries.test.ts` (manifest check plus a grep for `Math.random`/`Date.now`/`performance.now` in sim). Why: each layer is cheap, and together they catch both imports and hidden inputs.
- 2026-09-23 — The client typechecks the worker with a separate `tsconfig.worker.json` (`WebWorker` lib). Why: the DOM and WebWorker libs conflict in one program.
- 2026-09-23 — Added `pnpm format` (`biome check --write .`). Why: to apply Biome fixes; `pnpm lint` stays read-only.
- 2026-09-23 — `step(state, commands, content)` takes content as an argument, as in CLAUDE.md; the spec's `step(state, commands)` is older shorthand. Why: CLAUDE.md wins on engineering rules.
- 2026-09-23 — Tool versions at scaffold: TypeScript 7.0, Vitest 5.0, Biome 2.5, Vite 8.3, PixiJS 8.21, React 19.3, pnpm 11, Node ≥ 22.12. Why: latest stable versions at project start.
- 2026-09-23 — Trees are a `mapObjects` entry with generic fields (`resource`, `amount`, `gatherTicks`, `yieldPerGather`) instead of tree-specific ones. Why: the same shape fits later rocks and clay, and it costs nothing now.
- 2026-09-23 — Villager roles (`woodcutter`, `carrier`) are content, holding walk speed, carry capacity and idle retry. Walk speed is in milli-tiles per tick, so it stays an integer. Why: keeps every tuning number in content, as integers.
- 2026-09-23 — Buildings have a footprint (`size`) and a `door` tile just outside it that villagers walk to. Woodcutter's hut is 2×2; hut is 1×1. Why: a simple, explicit access point; footprints can block walking without villagers needing to enter tiles.
- 2026-09-23 — Milestone-0 numbers: tree 3 logs, 40 ticks per chop; walk 1.5 tiles/s; woodcutter's hut buffer 4 logs; hut costs 10 logs + 200 build ticks. Why: a hut completes in about 2 minutes at 1×, which is watchable at 3×.
- 2026-09-23 — State is ECS-lite: `state.components.<name>` stores are plain `Record<EntityId, T>`; an entity is the set of components sharing an ID. `idsOf()` returns IDs sorted ascending for any order-dependent loop. Why: JSON-safe, stable iteration, and an entity can change role (a site becomes a building and keeps its ID).
- 2026-09-23 — `step()` doesn't mutate its input: it deep-copies via a JSON round trip, then systems mutate the copy. Why: easy to test and to keep old states; the round trip also guards JSON-safety. Revisit if profiling on big maps shows the copy matters.
- 2026-09-23 — Trees and building/site footprints block walking; a villager's start tile never does. New sites don't reroute villagers already walking. Why: the simplest rules that make paths look sensible.
- 2026-09-23 — A* uses octile costs (1000 orthogonal, 1414 diagonal), doesn't cut corners past blocked tiles, and breaks ties by f, then h, then tile index. Why: deterministic paths that don't clip through tree trunks.
- 2026-09-23 — Placement: every footprint tile must be buildable and free of trees, footprints and doors; the door tile must be walkable and free. `canPlaceBuilding` is exported so the client preview uses the same rule. Why: keeps every door reachable and keeps game logic in sim.
- 2026-09-23 — Invalid commands are ignored silently. Why: deterministic, and the UI already prevents the common cases.
- 2026-09-23 — Cancelling a construction site loses its delivered materials. Why: there's no storage to refund into in milestone 0.
- 2026-09-23 — Maps are ASCII `rows` plus lists of buildings and free villagers (`MapDef`); the milestone-0 map lives in `sim/src/maps/` as a fixture, as the milestone prompt asks. Tuning numbers (tree logs etc.) still come from content. Why: readable in review, and the layout isn't balance data.
- 2026-09-23 — Save format = `JSON.stringify(state)` with a `version` field; loading any other version throws. Why: CLAUDE.md says a save is the serialized state; the version check makes future migrations explicit.
- 2026-09-23 — The PRNG (mulberry32) is in place and seeded, but no milestone-0 system draws from it. Why: nothing in milestone 0 needs randomness, and ties already break by ID.
