# Monster movement and auto-resolve combat

Status: needs-info
Type: task
Blocked by: 01, 03

## What

- Monsters pick targets and move toward them.
- Combat resolves automatically when enemies are in range; health and damage from content.
- Villagers killed by monsters die (extends `m2-camp-winter/15`: cause "monster").
- Client: monster placeholder art, health bars during a fight.

## Open questions (design session 01, Q1–Q3)

- Combat model and targeting.

## Done when

- Headless tests: a monster attacks the nearest target; a fight resolves deterministically; deaths are recorded.
- `pnpm check` passes.
