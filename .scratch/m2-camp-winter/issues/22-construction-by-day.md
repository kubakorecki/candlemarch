# Construction runs only by day

Status: resolved
Type: task
Blocked by: 02

## What

Spec: Logistics, "Construction". There are still no builder villagers.

- A site's build timer, which starts once every material has arrived, advances only while it isn't night.

## Done when

- Headless test: a site whose materials arrive late in the day finishes the next morning, not during the night; save/load mid-night.
- `pnpm check` passes.

## Comments

2026-09-27 — Done: the construction system skips night ticks, so a site's timer holds from Dusk to Dawn. Test sets the site's materials as delivered 50 ticks before Dusk (rather than hauling them) and checks the exact finishing tick next morning, plus save/load mid-night.
