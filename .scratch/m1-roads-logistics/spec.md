# M1: Roads + logistics pick

Status: open
Created: 2026-09-25
Roadmap: `.scratch/v1/map.md`

## Goal

Lay dirt paths, build a small log network, and play the same scenario under **job dispatch (A)** and **flag relay (B)**. The owner playtests both, picks one (ADR-0001), and the other is deleted.

Done when the owner can start a new game on any scenario map with either model, watch logs flow continuously from woodcutters to stockpiles and construction sites, and has recorded the decision.

## Scope

### Jobs

- Villagers are generic people. A villager's **Job** is their Workplace's work, or Carrier if they have none.
- Content `villagerRoles` is renamed to `jobs` (with `JobId`), and code and tests follow. "Role" leaves the codebase.
- When a Workplace is finished, it drafts the **lowest-ID idle Carrier** as its worker. With no idle Carrier it stays unstaffed and shows a "no worker" icon, and it keeps trying.

### Dirt paths

- The player drags from one tile to another to lay an **L-shaped** path: horizontal leg first, then vertical. Free and instant.
- Paths are **4-connected**: two path tiles are linked only if they share an edge.
- Allowed on walkable, buildable tiles without trees, footprints or stockpiles. Allowed on door tiles.
- A **remove** tool drags the same L shape and removes path tiles, plus any flags on them.
- Walking on a path tile is faster by a speed percentage from content (start: 150). Off-road walking stays 8-directional at 100%.

### Road-aware pathfinding (model A)

- A* step cost = step length × 100 / the speed percentage of the tile being entered, in integer arithmetic. Carriers use paths when they're faster, and routes stay deterministic.

### Stockpiles (logs only in M1)

- The player drags a rectangle to create **one Stockpile**. Free and instant. Tiles must be buildable and free of trees, buildings, doors, paths and other stockpiles. A new rectangle never merges with an existing stockpile.
- Stockpile tiles are walkable and drawn as bare dirt. Buildings and paths can't be placed on them.
- **One resource per tile**, up to a per-tile capacity from content (start: 8). An empty tile takes whatever resource arrives first.
- A stockpile is both a **supply** and a **demand**. Construction sites always outrank stockpiles as demands. A stockpile never supplies another stockpile.
- Removing a stockpile loses its goods.

### Placeable woodcutter's hut

- The woodcutter's hut becomes placeable, with a log cost and build time from content (start: 6 logs, 200 ticks). Its worker is drafted as described under Jobs.

### Flag relay (model B)

- The player places **Flags** on path tiles, at least 2 tiles apart along the path. Every building and site door on a path counts as a Flag. A path tile orthogonally next to a stockpile can hold a Flag that serves that stockpile.
- A **Segment** is the path between two neighbouring Flags. Each Segment is staffed by one idle Carrier, oldest unstaffed Segment first. An unstaffed Segment shows a "no carrier" icon.
- Goods move **only along roads** in model B. A building whose door isn't on a road can't send or receive.
- A Flag holds up to 8 waiting goods (content number). When it's full, carriers delivering to it wait.
- At a stockpile Flag, the carrier unloads onto the nearest stockpile tile with room and picks up from the nearest tile holding the resource. Ties go to the lowest tile index.
- Removing a Flag or its path loses the goods waiting on it and the goods in the hands of that Segment's carrier. The carrier goes back to the idle pool.
- Model B plugs into the existing `LogisticsModel` seam (`state.logistics.model`).

### Scenario maps and the playtest

- Maps can include paths, flags and stockpiles at start.
- Three scenario maps: **short haul**, **long haul**, **branching network**. Each starts with a fixed number of Carriers, and both models draw from that same pool.
- A dev-only **New game** panel picks map (meadow + scenarios) and logistics model.
- Each scenario has a headless test proving goods arrive under both models.
- No throughput benchmark: the owner's playtest decides.

### Cross-cutting

- `normalizeLoadedState()` fills in state fields added after a save was made. `STATE_VERSION` is bumped only for breaking changes (e.g. the Job rename).
- Every sim feature gets a headless test. The determinism and save/load tests cover the new state.

## Out of scope

Cobblestone roads, handcarts, stockpiles for goods other than logs, builders, the hero, loose piles of dropped goods, the road heat-map and carrier-utilization meter.

## Tickets

See `issues/`.
