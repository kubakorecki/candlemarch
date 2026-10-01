# Design session: happiness and adjacency

Status: resolved
Type: grilling
Blocked by: none

## What

A `/grill-with-docs` session. Record answers in `docs/spec.md` and `CONTEXT.md`, then promote or rewrite the `needs-info` tickets that list this one.

## Questions

1. **Happiness sources:** which needs and conditions raise or lower it (food, warmth, home, adjacency, deaths)?
2. **Effect:** the work-speed curve; how long unhappiness must last before a villager leaves.
3. **Per villager or per house?**
4. **Adjacency:** the like/dislike table (smokehouse and tannery smell, smithy is loud, bakery cheers neighbours, …); radius; does it touch homes, workshops or both?
5. **Readability:** how the player sees why someone is unhappy and what a building will do to its neighbours before placing it.
6. Does happiness join the immigration conditions now?

## Done when

- Every question has an answer, and the dependent tickets are updated.

## Comments

2026-10-01 — Held together with 01 and 02. Recorded in `docs/spec.md` (Villagers: Happiness in M5, Adjacency in M5, Population) and `CONTEXT.md` (Happiness). Answers: a 0–100 score per villager from 50; about the good life, not survival (Hungry, Cold, Tired don't count); M5 sources are Homeless −30, −10 per death in 3 days, and adjacency (4 tiles, Homes only, once per kind: trees/Reserve, Shrine, brewery +10; smokehouse, charcoal kiln, brick kiln, bloomery, quarry −10); bands Happy ≥70 +20%, Unhappy <30 −20%; Unhappy 5 Dawns in a row leaves, not in winter; no Newcomers while the average is Unhappy; villager panel lists sources, placement preview shows ± badges. Tickets 18, 19 rewritten.
