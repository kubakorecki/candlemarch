# Charters

Status: ready-for-agent
Type: task
Blocked by: 06, 07, 08, 09, 10, 12, 13, 14, 24

## What

Spec: Trades and masters (Charters in M5). Glossary: Charter.

- From Hamlet the notice board shows up to 2 Charters at a time: a named Master of a trade the village doesn't have, with conditions and a fee. Trades are drawn with the seeded PRNG among the five Hamlet trades the village lacks; one Master per trade in M5.
- An offer stays up for 10 days, then is withdrawn; another of that trade can be posted later (content numbers).
- Conditions: a free place in a House, plus:

| Master | Workshop | Supply |
| --- | --- | --- |
| Carpenter | sawpit | woodcutter's hut |
| Mason | stonecutter or brick kiln | quarry |
| Butcher | smokehouse | hunter's lodge or fisher's hut |
| Brewer | brewery | farm |
| Smith | bloomery | mine or bog-iron digger, and a charcoal kiln |

- Fees 100–300 coin, the Smith's the dearest (content).
- Accepting is a command: refused unless every condition holds and the Treasury covers the fee. It pays the fee; the Master arrives at the entry tile like a Newcomer and walks to their free place.

## Done when

- Headless tests: Charters are posted and withdrawn on schedule; conditions are tracked; accepting before they hold is refused; accepting pays and brings the Master; determinism.
- `pnpm check` passes.
