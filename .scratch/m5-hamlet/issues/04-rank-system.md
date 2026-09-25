# Rank system and rank buildings

Status: needs-info
Type: task
Blocked by: 01

## What

- State: the village's current Rank (Camp, Hamlet, Village, Town).
- Content: per rank, its rank building, requirements and unlocks (buildings, invitations, features).
- The build menu shows only unlocked buildings; locked ones show what unlocks them.
- Completing a rank building raises the rank. The HUD shows rank and progress toward the next.

## Open questions (design session 01, Q1)

- How requirements are checked.

## Done when

- Headless tests: meeting requirements and completing the building ranks up; unlocks appear; determinism.
- `pnpm check` passes.
