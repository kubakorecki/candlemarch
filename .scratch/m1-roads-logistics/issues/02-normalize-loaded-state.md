# Fill in missing state fields on load

Status: ready-for-agent
Type: task
Blocked by: none

## What

Old saves keep loading when later features only **add** state.

- Add `normalizeLoadedState(state)` in `sim/src/save.ts`, called by `deserialize` after the version check.
- It fills missing top-level fields and missing component stores from a fresh default state. When a later ticket adds a field **inside** an existing component, that ticket adds one explicit line here.
- `STATE_VERSION` still guards breaking changes (renames, removals, changed meanings); a mismatch still refuses to load.
- Log the rule in `docs/decisions.md`.

## Done when

- Save/load test: serialize a state, delete a component store and a top-level field from the JSON, load it, and assert it equals the original state.
- A version mismatch still throws.
- `pnpm check` passes.
