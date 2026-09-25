# Stockpiles for all bulk goods

Status: ready-for-agent
Type: task
Blocked by: m1-roads-logistics/05

## What

- Content: a `storage` field per resource: `stockpile` (logs, stone, clay, hides, …), `granary` (food), or other stores later.
- Stockpiles accept any resource marked `stockpile`, one resource per tile as in M1.
- Food never goes to a stockpile.

## Done when

- Headless test: two resources share a stockpile on different tiles; food is refused.
- `pnpm check` passes.
