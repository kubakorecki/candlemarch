# Hero: gather and hand-carry

Status: needs-info
Type: task
Blocked by: m1-roads-logistics/11, 01

## What

The hero kickstarts the village by hand (spec logistics stage 1, "Hero hand-carry").

- Right-click a tree: walk there, chop (same gather rules as a woodcutter), carry the logs.
- Right-click a building, stockpile or site while carrying: deliver there if it accepts the resource.
- Right-click a building or stockpile with stock while empty-handed: pick up.
- Hero carry capacity from content.

## Open questions (settle when the logistics model is picked)

- Under flag relay, may the hero carry off-road, or only drop goods at Flags?
- Should the dispatcher count goods the hero is carrying towards a site (so carriers don't double-deliver)?

## Done when

- Headless tests for each order, determinism, save/load.
- `pnpm check` passes.
