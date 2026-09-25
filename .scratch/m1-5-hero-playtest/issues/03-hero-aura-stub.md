# Hero: production aura (stub)

Status: ready-for-agent
Type: task
Blocked by: 01, m1-roads-logistics/06

## What

- Content on the hero: `aura: { radiusTiles, speedPercent }` (start: 5 tiles, 125%).
- Workplaces whose footprint has a tile within the radius work faster: gather/production ticks are scaled by `100 / speedPercent` (integer, at least 1 tick).
- The sim exposes which workplaces are boosted; the client draws the radius when the hero is selected and marks boosted workplaces.

## Done when

- Headless test: a woodcutter chops faster with the hero nearby than without.
- `pnpm check` passes.
