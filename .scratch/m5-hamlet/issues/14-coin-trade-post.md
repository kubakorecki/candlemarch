# Coin, trade post and merchants

Status: needs-info
Type: task
Blocked by: 02, 04

## What

- Coin in state. The trade post (unlocked at Hamlet) with a market stockpile of goods set aside for sale.
- Merchants visit on a schedule and buy from the market stockpile. Prices drop when a good is flooded. Higher reputation means more frequent, richer merchants.
- The HUD shows coin; a trade panel shows prices and the next visit.
- First sellable goods include hides.

## Open questions (design session 02, Q1–Q3)

- Coin model, schedule, prices, market stockpile.

## Done when

- Headless tests: a visit sells goods for coin; flooding lowers the price; determinism.
- `pnpm check` passes.
