# Design session: survival rules

Status: resolved
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

## Comments

2026-09-27 — Settled in a `/grill-with-docs` session. Answers are in `docs/spec.md` (World and map "Before full ecology (M2)"; Time; Resources "Spoilage" and "Firewood"; Logistics "Construction" and readability; Villagers "Daily life and survival" and "Population"; Heroes; Failure states "Alerts"; Progression "Starting Camp"; expansion backlog), with the spoilage model in [ADR-0002](../../../docs/adr/0002-spoilage-daily-share.md) and new terms in `CONTEXT.md`.

In short: Q1 one Meal at Dusk at the nearest Granary, no variety yet. Q2 Hungry after 1 missed Meal, starve after 3; Cold after 1 cold winter night, freeze after 2; each −50%, only the worst applies; plus Tired from a short night. Q3 cold slows Spoilage in winter and hunting continues; no drying rack. Q4 daily share (ADR-0002). Q5 Hut holds 3, automatic Homes nearest the Workplace, Homeless sleep in the open. Q6 finish what's in hand at Dusk, no proximity rule. Q7 one Newcomer per Dawn outside winter with a free place and 5 Meals per head. Q8 a separate Chopping block (Woodsplitter, 1 log → 2 firewood, pauses at a firewood target). Q9 Hunting grounds whose Game ceiling follows standing trees, with a catch chance. Q10 no builders; build timer runs by day. Q11 red and amber alerts plus a death log. Q12 Granary with 20 meat, Stockpile with 30 logs, 5 Homeless Carriers and the hero. Also: longer winter nights, no hero needs, forage patches that need shade, ticket 19's definitions.

Tickets 02, 06, 08, 10–17, 19 and 20 are rewritten; the `needs-info` ones are promoted to `ready-for-agent`. New ticket 22 (construction by day).
