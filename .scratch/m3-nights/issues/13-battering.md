# Gloamlings batter House doors and palisades

Status: resolved
Type: task
Blocked by: 04, 08

## What

Rules in `docs/spec.md`, "Nights in v1 (M3)" (Targets, Palisades). Numbers Proposed, all in content.

- A Gloamling with no villager or Hero in sight that reaches a lived-in House batters its door (60 HP). When the door breaks it kills one resident (lowest ID; cause `gloamling`) and picks a new target.
- A Gloamling that can't reach its target batters the palisade segment or Gate in its way (the first one on a path that ignores palisades), then carries on when it breaks.
- Doors and palisades heal to full at Dawn. Nothing to repair.
- Client: door and palisade damage shown while under attack.

## Done when

- Headless tests: a door breaks after the right number of hits and one resident dies; a palisade blocking the only path is battered through; both heal at Dawn; save/load mid-battering.
- `pnpm check` passes.

## Comments

- 2026-09-28: Done. Door HP is `content.combat.houseDoorHp` (60) on `building.hp`; a broken door kills the lowest-ID resident asleep at Home (none if nobody's home) and the House is no target until Dawn; a broken wall blocks nobody until Dawn and is drawn as stumps. Gloamlings prefer walkable targets and batter only when nothing in reach of their priority is walkable (details in docs/decisions.md). Health bars over battered doors and walls.
