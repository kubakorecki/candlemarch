# Points of interest

Status: needs-info
Type: task
Blocked by: 03, 06

## What

- Content for the 4–5 POI types (ruins with loot, abandoned mine, roadside shrine, monster dens, …) as handcrafted stamps the generator places.
- Exploring a POI (hero order) reveals its contents, e.g. loot.
- Monster dens use M3's den object.
- Hooks for later: a POI can hold a trapped master (M6 rescue invitation).

## Open questions (design session 03, Q6)

- Types, contents, counts.

## Done when

- Headless tests: POIs placed deterministically, never overlapping, explorable once.
- `pnpm check` passes.
