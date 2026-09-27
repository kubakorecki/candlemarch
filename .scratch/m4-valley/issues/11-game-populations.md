# Game populations and overhunting

Status: needs-info
Type: task
Blocked by: 03, m2-camp-winter/10

## What

- Game lives in forest regions with a population that drops with hunting and recovers slowly. Overhunting empties a region for seasons.
- Replaces M2's simple game count.
- An overlay or tooltip shows a region's game level.

## Open questions (design session 03, Q8)

- Regions, numbers, recovery.

## Done when

- Headless tests: population drops with hunting, recovers over time, an emptied region stays empty for the set time.
- `pnpm check` passes.

## Comments

2026-09-27 — M2 design session (m2-camp-winter/01) already gives each Hunting ground a Game count, a ceiling that follows standing trees (surplus flees when trees are felled), and a catch chance of 50% × game ÷ max. This ticket adds recovery: Game regrows toward the ceiling, and foresters raise the ceiling again. See spec, World and map, "Before full ecology (M2)".
