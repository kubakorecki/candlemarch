# Warmth: houses burn firewood in winter

Status: needs-info
Type: task
Blocked by: 01, 06, 13

## What

- In winter every occupied house burns firewood at a content rate. A house with firewood is warm.
- Houses are demands for firewood (a small house buffer) during autumn and winter.
- Residents of a cold house get colder over time.
- Client: a "no firewood" icon on cold houses.

## Open questions (design session 01, Q2)

- Rates, buffer size, how cold progresses.

## Done when

- Headless tests: firewood is delivered and burned in winter; a house without it goes cold.
- `pnpm check` passes.
