# Construction runs only by day

Status: ready-for-agent
Type: task
Blocked by: 02

## What

Spec: Logistics, "Construction". There are still no builder villagers.

- A site's build timer, which starts once every material has arrived, advances only while it isn't night.

## Done when

- Headless test: a site whose materials arrive late in the day finishes the next morning, not during the night; save/load mid-night.
- `pnpm check` passes.
