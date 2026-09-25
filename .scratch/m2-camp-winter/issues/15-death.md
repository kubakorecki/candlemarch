# Death by starvation and freezing

Status: needs-info
Type: task
Blocked by: 11, 14

## What

- A villager dies when hunger or cold passes its limit. The entity is removed; goods in hand are lost; their house place frees up; their Workplace position opens.
- Deaths are recorded in state (name, cause, day) for alerts and the HUD.

## Open questions (design session 01, Q2)

- Limits and any weakened stage before death.

## Done when

- Headless tests: starvation and freezing kill on schedule; the workplace re-drafts; determinism.
- `pnpm check` passes.
