# Death by starvation and freezing

Status: ready-for-agent
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
