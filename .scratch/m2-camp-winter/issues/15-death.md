# Death by starvation and freezing

Status: resolved
Type: task
Blocked by: 11, 14

## What

- **Starvation:** a villager whose missed-Meal count reaches 3 (content) dies at that Dusk.
- **Freezing:** a villager whose cold-night count reaches 2 (content) dies at that Dawn.
- On death: the entity is removed; goods in hand are lost; their House place frees up; their Workplace position opens and re-drafts.
- Deaths are recorded in state (name, cause, day) for the message log and alerts.

## Done when

- Headless tests: starvation and freezing kill on schedule; a Meal or a warm night in time prevents it; the workplace re-drafts; the Home frees; determinism.
- `pnpm check` passes.

## Comments

- 2026-09-27 — Done: `killVillager` in `sim/src/deaths.ts` and `state.deaths` (`{name, cause, day}`); starvation when the missed-Meal count reaches 3 (at Dusk, or at Dawn for a villager who never got to a Granary), freezing at Dawn when the cold-night count reaches 2. The dead lose goods in hand; the Home and Workplace position are derived, so they free up and staffing re-drafts. The frozen-river fishing test was adjusted: its Homeless, unfed fisher now dies before the thaw. No client yet; the message log and alerts are ticket 17.
