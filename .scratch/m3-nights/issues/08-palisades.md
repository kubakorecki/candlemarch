# Palisades and Gates

Status: resolved
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

## Comments

- 2026-09-28: Done. Content `palisade` and `gate` (1×1 buildings with `wall: WallDef`, door on their own tile); command `layWall {building, from, to}` lays a site per L tile (skipping tiles that already hold a wall; all or nothing); wall sites block nobody, built palisades block everyone, built Gates only Gloamlings (`blockedGrid(..., gatesBlock)`); HP stored on `building.hp` (null for non-walls). Gloamlings path round palisades, or lose a target they can't reach (battering is ticket 13). Beyond the issue: a Gate may stand on a Road and a Road may run through it. Client: `p`/`n` drag tools, stake and Gate art joining neighbours, wall sites without labels. See `docs/decisions.md`.
