# Fisher's hut and a frozen river

Status: ready-for-agent
Type: task
Blocked by: 02, 05, m1-roads-logistics/06

## What

- Content: resource `fish` (food). Building `fishers_hut`, placeable only with its door on a riverbank tile.
- The fisher works at the riverbank and yields fish.
- The river is frozen in winter (derived from the season): fishing stops. Draw frozen river differently.

## Done when

- Headless tests: placement rule, fishing yields, no fish in winter.
- `pnpm check` passes.
