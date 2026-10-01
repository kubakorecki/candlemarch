# Deepening a mine

Status: needs-info
Type: task
Blocked by: 01, m5-hamlet/06

## What

Spec: Resources (Renewing what runs out).

- A mine whose Deposits are dug out can be deepened once, for planks and coin, to get more ore.

## Open questions (design session 01, Q12)

- Cost, how much ore, once per Deposit or per group.

## Done when

- Headless tests: deepening a dug-out mine costs planks and coin and gives it more ore; it can't be deepened twice.
- `pnpm check` passes.
