# Food spoilage

Status: needs-info
Type: task
Blocked by: 01, 11

## What

- Content per food: shelf life (raw meat, fish, berries, mushrooms: days; others longer).
- Food in any store or buffer spoils over time and is removed.
- Designed so M6's root cellar can slow it by a percentage.

## Open questions (design session 01, Q3–Q4)

- Stack ages vs a daily share; whether cold slows spoilage in winter.

## Done when

- Headless tests: food spoils on schedule; different foods differ; determinism, save/load.
- `pnpm check` passes.
