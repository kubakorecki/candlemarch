# Coin, trade post and merchants

Status: ready-for-agent
Type: task
Blocked by: 02, 04, 28

## What

Spec: Economy (Coin; The trade post in M5). Glossary: Coin, Treasury, Trade post, Merchant, Wanted list.

- **Coin:** a Treasury total in state, shown on the HUD. Rank buildings and others can carry a coin construction cost, paid when the site is placed (refused if the Treasury can't cover it).
- **Base prices** for every good the village can produce, in content (scale: a log about 2, planks 6, hides 8, ale 8, iron bars 15, tools 40), plus a per-good price drop per unit sold.
- **Trade post** (Hamlet): keeps goods for sale in its Storage (ticket 28's panel). A sell rule per good, set in its panel: "keep N in the village, sell the rest"; Carriers haul the surplus in. Nothing is sold without a rule.
- **Merchants:** one arrives every 3 days and stays a day, never in winter. They buy everything in the Storage at current prices, coin to the Treasury.
- **Wanted list:** 2–3 goods (seeded PRNG) paid at +50%, announced when the previous merchant leaves.
- **Prices:** each unit sold lowers that good's price by its per-good drop, down to 30% of base; prices recover 10% of base per day. Prices kept as integers (e.g. hundredths of a coin).
- The trade post's panel shows prices, the wanted list and the next visit.
- Reputation is M6.

## Done when

- Headless tests: a sell rule moves surplus into the trade post; a visit sells it for coin; wanted goods pay +50%; selling many units lowers the price and it recovers over days; no merchant in winter; determinism.
- `pnpm check` passes.
