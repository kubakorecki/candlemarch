# Flag relay logistics model

Status: resolved
Type: task
Blocked by: 01, 03, 05

## What

Model B behind the `LogisticsModel` seam, selectable through `state.logistics.model`. Details in `../spec.md` under "Flag relay".

- Commands `placeFlag {x, y}` and `removeFlag {x, y}`. Flags go on path tiles at least 2 tiles apart along the path. Doors on a path act as Flags. A path tile orthogonally next to a stockpile can hold a Flag serving it.
- Segments are derived from paths and Flags. Each is staffed by one idle Carrier (oldest unstaffed Segment first), who walks there and stays.
- Goods move only along roads: a supply and a demand match only if their Flags are connected. Each good gets a destination and hops Flag to Flag along the shortest route (by Segment length, ties by Flag ID).
- A Flag holds at most `flagCapacity` goods (content, start: 8); carriers delivering to a full Flag wait.
- At a stockpile Flag, unload onto the nearest tile with room and load from the nearest tile holding the resource (ties by tile index).
- Removing a Flag or its path loses the goods on it and in the hands of its Segment's carrier; the carrier becomes idle.
- The sim exposes unstaffed Segments so the client can show a "no carrier" icon.
- Log routing and reservation choices in `docs/decisions.md`.

## Done when

- Headless tests: staffing, a multi-segment delivery to a site, full-flag waiting, a disconnected building gets nothing, stockpile flags, flag removal losing goods, determinism, save/load mid-relay.
- Job dispatch tests still pass.
- `pnpm check` passes.

## Comments

2026-09-25 — Done in `7eab3c1` (content, sim: add flag relay logistics model). Deleted in `df496a0` after the playtest (11) picked job dispatch; see ADR-0001.
