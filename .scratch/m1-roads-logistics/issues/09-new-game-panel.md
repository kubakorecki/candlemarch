# Dev New-game panel

Status: ready-for-agent
Type: task
Blocked by: 08

## What

- A dev-only React panel: dropdowns for map (meadow + scenarios, from the registry) and logistics model (A/B), and a Start button.
- Starting sends a new-game request to the worker, which builds the state with `createInitialState(seed, map, content, model)`.
- The HUD shows which model is running.
- Save/load keeps working (the model is part of the state).

## Done when

- Starting any map with either model works in the browser (`pnpm dev`).
- `pnpm check` passes.
