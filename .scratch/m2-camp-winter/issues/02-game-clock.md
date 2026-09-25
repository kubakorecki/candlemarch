# Game clock: days, nights and seasons

Status: ready-for-agent
Type: task
Blocked by: none

## What

- Content `calendar`: `dayTicks` (3 min = 3600 ticks), `nightTicks` share (1 min = 1200 of those), `daysPerSeason` (5), season order spring → summer → autumn → winter.
- Sim helpers derived from `state.tick` only (no new state): day number, time of day, `isNight`, season, year. Exported so systems and client share them.
- The game starts at dawn of spring day 1.
- Client: HUD clock (day, season, year) and a simple darkness tint at night.

## Done when

- Unit tests for the helpers at boundaries (dawn, dusk, season change, year change).
- Day/night visible in the browser.
- `pnpm check` passes.
