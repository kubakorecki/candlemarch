# Light is a wall Gloamlings never cross

Status: accepted (2026-09-28)

The spec said light "reduces spawns near buildings", but Gloamlings only spawn at Dens in the wilds, far from any building, so there was nothing near buildings for light to reduce. We decided that Gloamlings never step onto a lit tile: Light acts as a wall that burns firewood every night. It reads at a glance ("stay in the light"), needs no chance roll, and makes firewood a nightly cost of safety as well as warmth, tying threats to the wood chain.

## Considered options

- **Darkness spawns near the village**, alongside Den spawns, with Light suppressing the darkness spawns. Rejected: two spawn sources to explain and tune, and Dens would matter less.
- **Light as a soft deterrent** (Gloamlings may enter but are slowed or weakened). Rejected: harder to read, and every combat number would depend on how much light a tile has.

## Consequences

- Pathfinding for Gloamlings treats lit tiles as blocked. Light changes only at Dusk (fuel burns then, and nothing is built at night), so the blocked set is fixed for a whole night.
- A lit village would be untouchable for the price of firewood, so Light stays expensive: small radii, fuel every night, Houses served first when firewood runs short, and House windows give no Light.
- A torch beside a Den would switch the Den off, so nothing can be built within 6 tiles of a Den. The answer to a Den is clearing it.
- Palisades and watchtowers are still needed: Light covers little ground for its cost, while a palisade costs logs once.
