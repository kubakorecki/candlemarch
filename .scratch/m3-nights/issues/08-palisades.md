# Palisades and Gates

Status: ready-for-agent
Type: task
Blocked by: 01, 04

## What

Rules in `docs/spec.md`, "Nights in v1 (M3)" (Palisades). Numbers Proposed, all in content.

- Palisade segments, laid by dragging like a Road, built from logs via construction sites: 2 logs, 40 build ticks, 100 HP.
- A **Gate** segment (4 logs, 80 build ticks, 100 HP) that villagers and the Hero walk through and Gloamlings don't.
- Palisades block villagers and Gloamlings alike; villager pathfinding goes through Gates.
- HP is stored now; ticket 13 makes Gloamlings batter it.
- Nothing inside a Den's dark ring (ticket 03).
- Client: palisade and Gate placeholder art; drag tool.

## Done when

- Headless tests: Gloamlings path around palisades or stop; villagers use Gates; a site builds by day like any other.
- `pnpm check` passes.
