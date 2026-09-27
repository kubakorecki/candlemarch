# Stockpiles for all bulk goods

Status: resolved
Type: task
Blocked by: m1-roads-logistics/05

## What

- Content: a `storage` field per resource: `stockpile` (logs, stone, clay, hides, …), `granary` (food), or other stores later.
- Stockpiles accept any resource marked `stockpile`, one resource per tile as in M1.
- Food never goes to a stockpile.

## Done when

- Headless test: two resources share a stockpile on different tiles; food is refused.
- `pnpm check` passes.

## Comments

2026-09-27 — Done: content resources have `storage` (`stockpile` or `granary`); `stockpileTakes` gates carrier demands and hero deliveries, so Food never goes on a Stockpile, and `setStockpileAccepts` and the HUD ignore Food. `fish` is the first Food, added here so the refusal could be tested. Tests: logs and firewood on one pile on separate tiles; Food refused by the hero, the accepts command and (in `fishing.test.ts`) carriers.
