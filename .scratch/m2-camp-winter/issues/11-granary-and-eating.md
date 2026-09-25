# Granary and eating

Status: needs-info
Type: task
Blocked by: 01, 03, 07

## What

- Building `granary`: stores all food; it's a demand for food and the place villagers eat from.
- Each villager has a hunger need and eats at intervals.
- The villager panel shows hunger.

## Open questions (design session 01, Q1–Q2)

- Eating interval and amount; walk to the granary or delivered; what happens as hunger grows.

## Done when

- Headless tests: food flows to the granary; villagers eat and hunger resets; no food → hunger grows.
- `pnpm check` passes.
