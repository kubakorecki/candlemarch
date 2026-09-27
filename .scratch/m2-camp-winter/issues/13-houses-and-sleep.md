# Houses, Homes, sleep and Tired

Status: ready-for-agent
Type: task
Blocked by: 02, 03

## What

Spec: Villagers, "Daily life and survival".

- The Hut gets a resident capacity of 3 (content).
- **Home assignment:** each tick (or when places change), every Homeless villager in ID order gets a free place in the House nearest their Workplace by walking cost; Carriers, nearest to where they stand. Nobody is moved once housed; no manual assignment. A demolished House makes its residents Homeless. The villager panel shows the Home.
- **Dusk:** no new work or Haul starts. A Carrier holding goods finishes delivering them; one still walking to a pickup drops the Haul. A gatherer abandons a chop in progress and drops goods in hand at its Workplace. Then the villager walks home and sleeps (ticket 11 adds the Granary stop before home). Homeless villagers sleep where they stand.
- **Dawn:** villagers walk to work. One who hasn't reached home by Dawn turns back to work.
- **Tired:** a villager who slept less than half the night at Home (Homeless included) walks and works 50% slower until the next Dusk.
- **Slowdown helper:** one shared function gives a villager's speed percent as the worst of their slowdowns (Tired now; Hungry and Cold later), multiplied by the hero's aura where it applies. Walking and `workTicks` both use it.
- The hero ignores night.
- Existing timing tests (milestone-0 hut, M1 scenarios) finish before the first Dusk at tick 2400, so they should hold; check.
- Client: Homeless icon and count; "zzz" Tired icon; panel shows Home and Tired.

## Done when

- Headless tests: assignment by nearness and ID order; dusk behaviour for each case above; back to work at Dawn; turning back at Dawn; Tired from a short night and from sleeping Homeless, cleared by a full night; determinism, save/load mid-night.
- `pnpm check` passes.
