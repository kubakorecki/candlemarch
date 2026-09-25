# Design session: survival rules

Status: ready-for-human
Type: grilling
Blocked by: none

## What

A `/grill-with-docs` session that settles the M2 rules the spec leaves open. Record answers in `docs/spec.md` and `CONTEXT.md`, then promote or rewrite the `needs-info` tickets that list this one.

## Questions

1. **Eating:** how often does a villager eat, how much, and does variety matter yet (it's a Craftsfolk need)? Do villagers walk to the granary, or is food delivered to houses?
2. **Hunger and cold:** how long from "no food" / "no warmth" to death? Is there a visible sick/weak stage in between (work slower)?
3. **Winter food before the smokehouse:** raw meat and fish spoil in days and the smokehouse needs a Butcher (M5). How does a Camp survive its first winter: winter hunting, slower spoilage in the cold, or a simple no-master drying rack?
4. **Spoilage model:** does each stack carry an age, or does a fixed share of each food spoil per day? (This fixes the state shape for every store.)
5. **Houses:** hut capacity; how villagers are assigned homes; homeless villagers at night.
6. **Night:** what do workers and carriers do at dusk mid-task (drop goods, finish the trip)? Do houses need to be near workplaces?
7. **Immigration:** how much free housing and surplus food triggers a newcomer; how often; where they arrive (map edge?).
8. **Woodcutter's hut firewood:** does the hut switch between felling and splitting by a player setting, by demand, or does it get a second worker?
9. **Hunting before forest ecology:** a fixed game count per forest area that doesn't recover until M4, or something else?
10. **Builders:** do construction sites need builder villagers in v1 (milestone 0 skipped them)?
11. **Alerts:** which death-spiral alerts, and at what thresholds?
12. **Starting Camp:** hero + 5 settlers: what buildings and stock does a new game start with?

## Done when

- Every question has an answer in the spec, and the dependent tickets are updated.
