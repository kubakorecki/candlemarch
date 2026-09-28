# Gloamling movement and auto-resolve combat

Status: ready-for-agent
Type: task
Blocked by: 01, 03

## What

Rules in `docs/spec.md`, "Nights in v1 (M3)" (Gloamling, Combat, Targets). Numbers Proposed, all in content.

- Combat stats in content: HP, damage, cooldown ticks, reach. Gloamling 20 HP, 4 every 20 ticks, adjacent; villager 20 HP, 3 every 20 ticks.
- **Targeting:** a Gloamling picks the nearest target by walking distance within its sight (12 tiles): a villager out in the open (not asleep at Home) or the Hero. Ties go to the lowest ID. It picks again when its target dies. With nothing in sight it walks toward the nearest lived-in House and waits at its door (ticket 13 adds the battering).
- **Fighting:** a fighter hits its target when in reach and off cooldown; hits resolve in entity-ID order within a tick. A villager a Gloamling reaches fights back (stops its work, resumes after by the unassign rule for work in hand).
- Villagers go back to full HP at Dawn.
- A villager killed by a Gloamling dies through `killVillager` with cause `gloamling` (extends `m2-camp-winter/15`), so game over and the deaths list work as they do.
- The Hero is a valid target but doesn't fight back yet (ticket 05).
- Client: Gloamling movement, health bars during a fight.

## Done when

- Headless tests: a Gloamling goes for the nearest target; ties by ID; a one-on-one fight resolves the same way every run; deaths are recorded with their cause; HP resets at Dawn; save/load mid-fight.
- `pnpm check` passes.
