# Delivery orders

Status: ready-for-agent
Type: task
Blocked by: 10, 14

## What

Spec: Trades and masters (Side quests in M5). Glossary: Delivery order.

- The notice board posts one Delivery order at a time: a good the village can make, an amount, a deadline and a coin reward (content table, picked with the seeded PRNG), e.g. "30 smoked fish within 10 days for 200 coin". A new one is posted a few days after the last closes.
- Delivered by Carriers to the trade post once the player accepts it; done when the amount is in, failed at the deadline (no penalty beyond losing it).
- No recurring orders.

## Done when

- Headless tests: an order is posted, accepted, filled for its reward; an unfilled order fails at its deadline; determinism.
- `pnpm check` passes.
