# M3: Nights bite

Status: open
Created: 2026-09-25
Roadmap: `.scratch/v1/map.md`

## Goal

Monsters come out of dens at night. Light, palisades, watchtowers, the militia and the hero keep the village alive. Combat is light and automatic: the player positions and prepares, units fight on their own.

Done when a prepared village survives several nights with losses that feel fair, and an unprepared one suffers, in a headless test and in the owner's playtest.

## Scope

From `docs/spec.md` (Threats and combat; Heroes):

- One monster type. Dens in the wilds spawn monsters at night and slowly multiply toward the village.
- Light (torches, braziers) burns firewood and reduces spawns near buildings.
- Auto-resolved combat. Villagers can die to monsters.
- Hero fights; when defeated, knocked out and recovers after a while.
- Militia bell: villagers drop their jobs to fight.
- Palisades block paths; watchtowers spot and shoot.
- Hero and militia clear dens by day for loot.
- Night rendering: darkness with warm light sources.

- A **Monster rate** setting per game, so nights can be turned off (0) for economy testing.

## Waiting on

Nothing. Design session 01 is done (2026-09-28): rules in `docs/spec.md`, "Nights in v1 (M3)", and `docs/adr/0003-light-is-a-wall.md`. Hero combat no longer waits on the hero playtest.
