# Design session: coin, trade, tools, farms and standing orders

Status: resolved
Type: grilling
Blocked by: none

## What

A `/grill-with-docs` session. Record answers in `docs/spec.md` and `CONTEXT.md`, then promote or rewrite the `needs-info` tickets that list this one.

## Questions

1. **Coin:** where it lives (a village treasury number, or a physical good that must be stored and hauled)?
2. **Merchants:** schedule, what they buy, base prices, how prices drop when a good is flooded and recover, how reputation grows and what it changes.
3. **Market stockpile:** a special stockpile, or any stockpile marked "for sale"?
4. **Imports:** what can be bought, at what price, and how bought goods arrive.
5. **Tools:** is it one "tools" good or several (axe, pick, sickle, hammer)? How a worker gets one; wear per use or per day; "half speed without a tool".
6. **Farms:** fields painted by the player or fixed to the farm? Sowing, growth and harvest timing per season; seeds?
7. **Standing orders:** the rule shapes ("keep N of X", "pause building above M"); per building or village-wide; the UI.
8. **Deposits running out** (from the M4 design session): when a non-renewable Deposit is dug out, can the village get stone or ore some other way (imports, new Deposits, something else)? Many chains stop without them.
9. **Ruins Caches:** which of iron bars, tools and coin M5 adds to a searched Ruins' Cache, and how much.

## Done when

- Every question has an answer, and the dependent tickets are updated.

## Comments

2026-10-01 — Held together with 01 and 03. Recorded in `docs/spec.md` (Deposits; Farms and crops; Renewing what runs out; Bees and candles; Where goods are kept; Economy) and `CONTEXT.md`. Answers: coin is a Treasury number; goods for sale wait in the trade post's Storage (no separate market stockpile), sold by a per-good "keep N" rule, every produced good sellable; a merchant every 3 days outside winter with a wanted list; per-good price drop to a 30% floor, 10%/day recovery; imports at 2× (stone, clay, iron ore, iron bars, tools, grain, turnip seeds); reputation to M6. Tools: one good, +50% work speed with one (not a penalty without), hides need tools, wear after about a year, worn tools vanish until M6's scrap. Farms: painted Fields, grain (Food, no seeds) and turnips (seeds bought once), one crop per farm. Standing orders: one pause threshold per Workplace; idle workers help carry. Deposits: groups of 3–20, one Deposit ≈ 2 seasons for one worker, clay refills ¼ each spring, bog iron in Swamps, fieldstones from Fields; scrap smelter, deepening, salvage, bricks-for-stone in principle for M6. Ruins Caches gain 50 coin and 2 tools. Tickets 06, 07, 13–17 rewritten; new tickets 23–29.
