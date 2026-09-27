# Candlemarch

A medieval-fantasy village builder where the fun is designing a settlement that runs itself: gather resources, invite master craftspeople, chain their trades into a self-running economy, and survive winters and monster-filled nights.

**Source of truth for design:** `docs/spec.md`. Read the relevant section before building a feature. Items tagged *Decided* are fixed; items tagged *Proposed* are working defaults that may change, so don't hard-wire them deeper than needed.

**Current stage:** milestone 0 (see "First build target" in the spec).

## Stack

- TypeScript (strict) everywhere
- pnpm workspaces monorepo
- Simulation: hand-rolled, deterministic, fixed-tick entity-component system, run in a Web Worker
- Rendering: PixiJS v8
- UI: React for panels, menus and HUD over the Pixi canvas
- Build: Vite
- Tests: Vitest
- Lint and format: Biome
- Desktop packaging (Electron) comes later; not part of milestone 0

## Repository layout

```
packages/
  content/   typed game data: resources, buildings, recipes. No logic.
  sim/       game state, step(), commands, save/load. Pure TypeScript.
  client/    Vite app: Pixi world rendering, React UI, worker hosting the sim.
docs/
  spec.md       design spec
  decisions.md  short log of implementation decisions
```

Import rules. These are hard boundaries; don't break them:

| Package | May import |
| --- | --- |
| `content` | nothing |
| `sim` | `content` only. No DOM, no Pixi, no React, no browser APIs. |
| `client` | `sim`, `content` |

## Commands

Keep this section current whenever scripts change.

- `pnpm install` — install dependencies
- `pnpm dev` — run the client in the browser
- `pnpm test` — run all tests
- `pnpm typecheck` — type-check all packages
- `pnpm lint` — Biome check
- `pnpm format` — apply Biome formatting and safe fixes
- `pnpm balance <scenario>` — run a headless balance scenario from `tooling/balance/scenarios.ts` and print population, deaths and stored goods per in-game day
- `pnpm check` — typecheck + lint + test; run before calling any task done

## Simulation rules

These keep the game testable, saveable and replayable. Treat them as non-negotiable.

- **Pure and deterministic.** `step(state, commands, content)` advances exactly one tick. The same seed and the same command stream must always produce identical state.
- **No hidden inputs.** No `Math.random`, `Date.now`, `performance.now`, timers or I/O inside `sim`. Randomness comes from a seeded PRNG whose state lives in game state.
- **Fixed tick rate:** 20 ticks per second. The client decides how many ticks to run per frame from real time × game speed. Pause means no ticks.
- **Plain data state.** Game state is JSON-serializable: plain objects, arrays, numbers, strings, booleans. No classes, Maps, Sets or functions in state. A save file is the serialized state.
- **Integers.** Quantities are integers. Positions use integer sub-tile units (e.g. 1 tile = 1000 units) so movement never drifts.
- **Stable IDs.** Entity IDs are integers from a counter stored in state. Iterate in ID order wherever order affects the result.
- **Commands are the only way in.** Every player action (place building, cancel, set priority) is a serializable command object queued for the next tick. The UI never mutates state directly.
- **Systems are small functions** over state, run in a fixed, documented order each tick.

## Client rules

- The sim runs in a Web Worker. The main thread sends commands and receives state snapshots or diffs, then renders.
- Rendering interpolates between the last two ticks so motion stays smooth at any frame rate.
- All isometric math (grid ↔ world ↔ screen) lives in one module.
- No game logic in the client. If the client needs to know something, the sim computes it.
- Camera: pan by dragging, zoom with the mouse wheel. No WASD hero movement; the hero (later) is mouse-controlled, RTS style.

## Content rules

- All game data lives in `packages/content` as typed TypeScript data: resource IDs, building definitions, recipes, costs.
- IDs are string literal unions, so a typo is a type error.
- A content validation test checks that every reference (recipe inputs and outputs, building costs) points at an existing ID.

## Art (placeholder phase)

- Direction: polished, cartoony, slightly dark, for adults. References: Don't Starve, Hollow Knight, Graveyard Keeper. **Not pixel art.**
- Placeholders: simple shapes drawn in code or SVG, with bold dark outlines and flat, desaturated earthy fills.
- Define the palette once in a single module and use it everywhere.
- Isometric tiles are 2:1. Keep tile size in one constant so it can change. Final art will likely be authored at 256×128 per tile.

## Testing

- Every sim feature ships with a headless Vitest test that drives the sim with commands and asserts on state.
- Keep a **determinism test**: run the same scenario twice and assert deep equality.
- Keep a **save/load test**: save mid-run, load, continue, and assert the result equals an uninterrupted run.
- Tests must stay fast. Use small hand-made maps in tests.

## Working conventions

- Read `docs/agents/code-map.md` before exploring the code. When you add, move or rename a module, update the map in the same commit.
- Work in small, reviewable steps. Run `pnpm check` before saying a step is done.
- When the spec is ambiguous, choose the simplest option that keeps the design open, and log it in `docs/decisions.md` (one line: date, decision, why).
- Don't build future features ahead of time.
- Prefer clear, boring code over clever abstractions. The owner reviews everything.
- Commit messages: short imperative summary, e.g. `sim: add hauling system`.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. Read `docs/agents/issue-tracker.md` before creating, starting or finishing an issue: it covers numbering, blockers and closing (`Status: resolved` in the finishing commit).

### Triage labels

Default five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded on each issue's `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
