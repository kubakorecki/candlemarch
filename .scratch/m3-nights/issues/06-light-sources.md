# Torches and braziers

Status: needs-info
Type: task
Blocked by: 01, 03, m2-camp-winter/06

## What

- Placeable torch and brazier. They burn firewood at night (a firewood demand) and give light in a radius.
- Light reduces monster spawns near buildings.
- The client uses the glow from ticket 02.

## Open questions (design session 01, Q5)

- Radius, burn rate, spawn rule.

## Done when

- Headless tests: firewood is burned at night only; spawns drop inside lit areas.
- `pnpm check` passes.
