# Hunter's lodge

Status: needs-info
Type: task
Blocked by: 01, 07, m1-roads-logistics/06

## What

- Content: resources `meat` (food), `hides` (stockpile). Building `hunters_lodge` with a hunter.
- The hunter hunts game in forest near the lodge and returns meat and hides.
- Hides pile up until the trade post (M5) can sell them.

## Open questions (design session 01, Q9)

- How game is counted before forest ecology (M4) adds recovery.

## Done when

- Headless tests: hunting yields meat and hides; game runs out as decided.
- `pnpm check` passes.
