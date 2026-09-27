# Game clock: days, nights and seasons

Status: resolved
Type: task
Blocked by: none

## What

- Content `calendar`: `dayTicks` (3 min = 3600 ticks), `nightTicks` **per season** (spring, summer, autumn 1 min = 1200; winter 1.5 min = 1800, all taken from the same 3-minute day), `daysPerSeason` (5), season order spring → summer → autumn → winter.
- Sim helpers derived from `state.tick` only (no new state): day number, time of day, `isNight`, Dusk and Dawn ticks, season, year. Exported so systems and client share them.
- The game starts at Dawn of spring day 1.
- Client: HUD clock (day, season, year) and a simple darkness tint at night.

## Done when

- Unit tests for the helpers at boundaries (Dawn, Dusk, a winter Dusk coming earlier, season change, year change).
- Day/night visible in the browser.
- `pnpm check` passes.

## Comments

2026-09-27 — Done in `f8672e2` (content, sim, client: add the game clock with days, nights and seasons).
