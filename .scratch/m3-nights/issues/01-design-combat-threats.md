# Design session: combat and threats

Status: ready-for-human
Type: grilling
Blocked by: none

## What

A `/grill-with-docs` session for the M3 rules. Record answers in `docs/spec.md` and `CONTEXT.md`, then promote or rewrite the `needs-info` tickets that list this one.

## Questions

1. **The monster:** what is v1's one enemy type (name, look, tone)? Health, damage, speed, attack range.
2. **Combat model:** hit points and damage per hit on a timer, or a simpler strength comparison? How are ties and focus fire resolved deterministically?
3. **Targets:** what do monsters go for (nearest villager, buildings, stores, light sources)? Do they damage buildings?
4. **Dens:** spawn count and rate per night; how dens spread toward the village; what a den looks like; loot for clearing one.
5. **Light:** torch vs brazier radius and firewood use; is "reduces spawns" a hard no-spawn zone or a lower chance? Do lit houses' windows count?
6. **Militia:** who answers the bell (all adults, only carriers)? How it ends; what happens to goods in hand.
7. **Palisades and watchtowers:** cost, health, gates (can villagers pass?), tower range and damage, who staffs a tower.
8. **Hero combat:** hero strength; knockout duration; where the hero recovers before a village hall exists.
9. **Pressure curve:** how the threat grows over seasons (winter highest, longer nights).

## Done when

- Every question has an answer in the spec, and the dependent tickets are updated.
