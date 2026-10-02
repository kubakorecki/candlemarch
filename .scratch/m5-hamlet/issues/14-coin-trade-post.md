# Coin, trade post and merchants

Status: resolved
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

## Comments

- 2026-10-02: Done. The Treasury (`state.treasury`, kept in hundredths of a coin, shown in whole coins first on the Ledger), a `construction.coin` cost refused when the Treasury can't cover it and paid when the site is placed (no M5 building has one yet), a base price and per-unit drop on every good, the trade post (Hamlet, one a village; Storage of 100 goods for sale in its panel via `StorageFacts`), sell rules set in its panel ("Sell", then − Keep N +, ×), Merchants every 3rd day outside winter who buy everything in the Storage at once on arrival and leave at the next Dawn, a 2–3 good Wanted list at +50% drawn when the previous Merchant leaves, prices falling per unit to 30% of base and recovering 10% of base each Dawn. The panel shows each good's price, the Wanted list and the next visit. Differences: the Merchant buys only on arrival, so goods hauled in while it's there wait for the next one; goods for sale don't count as what the village holds (so standing orders keep producing). Checked by tests and typecheck; not looked at in the browser.
