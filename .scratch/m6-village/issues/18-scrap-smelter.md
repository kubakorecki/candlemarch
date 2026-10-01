# Scrap smelter

Status: needs-info
Type: task
Blocked by: 01, 06, m5-hamlet/16

## What

Spec: Resources (Renewing what runs out).

- A worn tool comes back as scrap instead of vanishing.
- A scrap smelter turns scrap and charcoal into iron bars, so tool wear is a loop, not only a drain.

## Open questions (design session 01, Q12)

- Rates, building cost, whether it needs the Smith.

## Done when

- Headless tests: a worn tool leaves scrap; the smelter turns scrap and charcoal into iron bars.
- `pnpm check` passes.
