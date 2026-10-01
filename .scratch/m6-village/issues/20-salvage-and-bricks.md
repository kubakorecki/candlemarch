# Salvage and bricks for stone

Status: needs-info
Type: task
Blocked by: 01, m5-hamlet/06, m5-hamlet/12

## What

Spec: Resources (Renewing what runs out).

- Demolishing a building returns part of its stone.
- Some building costs accept bricks in place of stone.

## Open questions (design session 01, Q12)

- The salvage share; which costs accept bricks and at what ratio; how a site with an either/or cost asks Carriers for goods.

## Done when

- Headless tests: demolishing returns stone; a site that accepts bricks completes with bricks.
- `pnpm check` passes.
