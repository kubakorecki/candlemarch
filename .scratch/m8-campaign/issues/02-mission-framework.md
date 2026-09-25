# Mission framework

Status: needs-info
Type: task
Blocked by: 01

## What

- Missions in content: map, starting state, objectives, fail conditions, tutorial steps.
- Objective and failure checks run in the sim (deterministic, saved with the game).
- The client shows objectives, progress, win and fail screens, and tutorial prompts.
- Campaign menu with mission progress stored outside the sim (client storage).

## Done when

- Headless tests: an objective completes, a fail condition fails the mission, save/load mid-mission.
- `pnpm check` passes.
