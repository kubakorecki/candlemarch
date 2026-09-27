# Granary, Meals and hunger

Status: ready-for-agent
Type: task
Blocked by: 03, 07, 13

## What

Spec: Villagers, "Daily life and survival".

- Building `granary`: stores all food; it's a demand for food. Food never goes to a Stockpile.
- **Meal at Dusk:** on the way home (ticket 13), each villager walks to the nearest Granary with food by walking cost, eats 1 unit (content), then goes home. Food eaten first: the highest Spoilage rate, ties by resource ID (until ticket 12 adds rates, by resource ID). No food: they go home without a Meal.
- **Hungry:** a per-villager count of missed Meals in a row. At 1 or more the villager is Hungry: walks and works 50% slower (content), through the shared "worst slowdown applies" helper from ticket 13. A Meal resets the count. Death at the limit is ticket 15.
- The hero never eats.
- Client: the villager panel shows hunger ("2 days without food; dies after 3"); a Hungry icon.

## Done when

- Headless tests: food flows to the granary; villagers eat at Dusk and the count resets; no food → the count grows and the villager slows; the fastest-spoiling food goes first; determinism, save/load.
- `pnpm check` passes.
