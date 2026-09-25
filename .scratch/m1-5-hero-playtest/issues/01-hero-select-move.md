# Hero: spawn, select and move

Status: ready-for-agent
Type: task
Blocked by: m1-roads-logistics/04

## What

- Sim: a `hero` component (one per game), spawned from `MapDef` (optional `hero: {x, y}`). Walk speed from content (`heroes` content with one placeholder hero for now).
- Command `orderHero {order: 'move', x, y}`: path there with the same A* (road-aware) as villagers. A new order replaces the current one.
- Client: left-click the hero to select, right-click a tile to move, Esc deselects. Draw the hero as a distinct placeholder shape with a selection ring. No WASD.

## Done when

- Headless tests: spawn from map, move order arrives, a new order replaces the old one, determinism, save/load.
- Works in the browser.
- `pnpm check` passes.
