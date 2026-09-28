# Watchtowers and the Watchman's night shift

Status: ready-for-agent
Type: task
Blocked by: 01, 04

## What

Rules in `docs/spec.md`, "Nights in v1 (M3)" (Watchtowers). Numbers Proposed, all in content.

- Building: watchtower, 1×1, 12 logs, employs one **Watchman**.
- **Night shift:** the Watchman eats at Dusk like everyone, then walks to the tower instead of Home and stands in it until Dawn; at Dawn walks Home and sleeps there until Dusk. Tired is decided from sleep at Home by day for a Watchman (the same threshold, over the day's ticks). A Watchman at the tower in winter isn't Cold (the tower counts as shelter), so the job isn't a death sentence; log this if it changes.
- The tower shoots the nearest Gloamling within 6 tiles for 5 every 30 ticks, only while its Watchman is in it. Ties by ID.
- Towers can't be attacked.
- If this runs long, split it: "Watchman night shift" first, then "tower shooting".

## Done when

- Headless tests: the Watchman's routine across a whole day; Tired from day sleep; the tower shoots in range and ignores Gloamlings outside it; an unstaffed tower does nothing; save/load mid-shift.
- `pnpm check` passes.
