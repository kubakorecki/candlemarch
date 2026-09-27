# Spoilage takes a daily share of each stack, not per-lot ages

Status: accepted (2026-09-27)

Food spoils. We model that as a share of each stack lost at every Dawn: a store holding `n` of a Food loses `ceil(n × rate%)`, with the rate set per Food in content. Stores stay plain integer amounts, so hauls, Stockpiles, buffers, the hero's hands and saves need no new shape. The root cellar (M6) and winter cold only lower the rate. A big raw hoard always leaks, which is what "preservation is its own tech" asks for: smoking (M5) and cellars are the way to keep food, not careful first-in, first-out bookkeeping.

## Considered options

- **Lots with ages.** Every store, buffer and carrier's hands would hold `{amount, spoilsAtTick}` lots, so shelf lives would be exact ("fish keeps 3 days") and villagers would eat the oldest food first. Rejected: every Haul, deposit and Meal would have to split and merge lots, which touches dispatch, Stockpiles and the hero's orders, and the state gets bigger with every delivery.
- **One freshness value per stack**, averaged on each deposit. Rejected: it costs almost as much as lots and is hard to explain to players.

## Consequences

- A shelf life works like a half-life, not an expiry date. The spec and the UI talk about "loses N% a day", not "keeps N days".
- Rounding up means a stack of 1 always goes at the next Dawn, so small leftovers don't linger forever.
- Food in someone's hands doesn't spoil; hauls are too short for it to matter.
